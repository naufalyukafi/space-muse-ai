import { getAuthContext, initStorage } from '@/lib/supabase-server';
import { buildPrompt } from '@/lib/prompt-builder';
import { generateInteriorDesign } from '@/lib/gemini';
import { validateGenerateInput } from '@/lib/validate';
import { revalidatePath } from 'next/cache';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiBadRequest,
  apiServerError
} from '@/lib/api-response';

export const maxDuration = 60;

type GenerationRow = {
  id: string;
  user_id: string;
  room_type: string;
  style: string;
  palette: string;
  notes: string | null;
  prompt_built: string;
  original_url: string;
  result_url: string;
  status: string;
  created_at: string;
};

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) {
      return apiUnauthorized();
    }
    const { userId, scopedClient } = auth;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiBadRequest('Invalid parameters');
    }

    const room_photo = formData.get('room_photo') as File | null;
    const reuse_image_url = formData.get('reuse_image_url') as string | null;
    const room_type = formData.get('room_type') as string | null;
    const style = formData.get('style') as string | null;
    const palette = formData.get('palette') as string | null;
    const notes = formData.get('notes') as string | null;

    // Run first stage input validation BEFORE any Supabase/Gemini calls
    const initialValidation = validateGenerateInput({
      room_type,
      style,
      palette,
      notes,
      room_photo,
      reuse_image_url
    });

    if (!initialValidation.isValid && initialValidation.error) {
      return apiError(
        initialValidation.error.message,
        initialValidation.error.code,
        initialValidation.error.status
      );
    }

    // Prepare image buffer & content type variables
    let imageBuffer: Buffer;
    let mimeType: string;

    if (room_photo) {
      const arrayBuffer = await room_photo.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      mimeType = room_photo.type;
    } else if (reuse_image_url) {
      // Fetch image from URL
      try {
        const res = await fetch(reuse_image_url);
        if (!res.ok) {
          console.error(`Failed to fetch reuse image from URL ${reuse_image_url}: ${res.statusText}`);
          return apiBadRequest('Failed to fetch the original image for redesign. Ensure the URL is valid.');
        }
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await res.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        mimeType = contentType;
      } catch (fetchErr) {
        console.error('Error fetching reuse image URL:', fetchErr);
        return apiServerError('Error accessing original image for redesign', 'IMAGE_FETCH_ERROR');
      }

      // Run validation on fetched image details
      const fetchedValidation = validateGenerateInput(
        {
          room_type,
          style,
          palette,
          notes,
          room_photo: null,
          reuse_image_url
        },
        { buffer: imageBuffer, mimeType }
      );

      if (!fetchedValidation.isValid && fetchedValidation.error) {
        return apiError(
          fetchedValidation.error.message,
          fetchedValidation.error.code,
          fetchedValidation.error.status
        );
      }
    } else {
      return apiBadRequest('Missing room photo or image URL');
    }

    // Now, validate is complete. Set up Streaming using ReadableStream/TransformStream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sendProgress = (stepMessage: string) => {
      writer.write(
        encoder.encode(JSON.stringify({ status: 'progress', message: stepMessage }) + '\n')
      );
    };

    const sendSuccess = (data: any) => {
      writer.write(
        encoder.encode(JSON.stringify({ status: 'success', data }) + '\n')
      );
    };

    const sendError = (message: string, code: string, statusCode: number) => {
      writer.write(
        encoder.encode(JSON.stringify({ status: 'error', message, code, statusCode }) + '\n')
      );
    };

    // Process asynchronously in background and resolve stream chunks
    (async () => {
      try {
        // Step 1: Initialize storage client
        sendProgress('Preparing storage...');
        await initStorage();

        const uuid = crypto.randomUUID();
        const originalPath = `${userId}/${uuid}-original.jpg`;
        const promptBuilt = buildPrompt(room_type!, style!, palette!, notes);

        // Step 2 & 3: Upload original image & generate redesign in parallel
        sendProgress('Uploading original room photo & redesigning room with Gemini AI...');

        let uploadSucceeded = false;
        let uploadError: any = null;
        let resultBuffer: Buffer | null = null;

        const uploadPromise = (async () => {
          const { error } = await scopedClient
            .storage
            .from('room-uploads')
            .upload(originalPath, imageBuffer, {
              contentType: mimeType,
              upsert: true
            });
          if (error) {
            uploadError = error;
            throw error;
          }
          uploadSucceeded = true;
        })();

        const geminiPromise = (async () => {
          let attempts = 0;
          const maxAttempts = 2; // Initial try + 1 retry

          while (attempts < maxAttempts) {
            try {
              attempts++;
              return await generateInteriorDesign(imageBuffer, mimeType, promptBuilt);
            } catch (err: unknown) {
              const errorMsg = err instanceof Error ? err.message : '';
              const isLastAttempt = attempts >= maxAttempts;
              const isEmptyResponse = errorMsg === 'EMPTY_RESPONSE';

              if (isEmptyResponse && !isLastAttempt) {
                console.warn(`[API] Gemini returned EMPTY_RESPONSE. Retrying attempt ${attempts + 1}...`);
                continue;
              }
              throw err;
            }
          }
          throw new Error('EMPTY_RESPONSE');
        })();

        try {
          const [, geminiRes] = await Promise.all([uploadPromise, geminiPromise]);
          resultBuffer = geminiRes;
        } catch (err: unknown) {
          if (uploadError) {
            console.error('Error uploading original image:', uploadError);
            sendError('Server error, please try again', 'STORAGE_UPLOAD_ERROR', 500);
            return;
          }

          if (uploadSucceeded) {
            console.log('Gemini failed after upload succeeded, cleaning up original image...');
            try {
              await scopedClient.storage.from('room-uploads').remove([originalPath]);
            } catch (cleanupErr) {
              console.error('Failed to clean up orphaned original image:', cleanupErr);
            }
          }

          const errorMsg = err instanceof Error ? err.message : '';
          console.error('Gemini generation error:', err);
          if (errorMsg === 'TIMEOUT') {
            sendError('AI is busy, try again later', 'TIMEOUT', 504);
          } else if (errorMsg === 'EMPTY_RESPONSE') {
            sendError('Image could not be processed', 'EMPTY_RESPONSE', 422);
          } else if (errorMsg.includes('429') || errorMsg.includes('Quota exceeded')) {
            sendError(
              'AI rate limit or quota exceeded. Please wait a moment before trying again.',
              'RATE_LIMIT_ERROR',
              429
            );
          } else {
            sendError(`AI Generation failed: ${errorMsg || 'Unknown error'}`, 'GENERATION_ERROR', 500);
          }
          return;
        }

        if (!resultBuffer) {
          sendError('Image could not be processed', 'EMPTY_RESPONSE', 422);
          return;
        }

        // Step 4: Upload resulting image using ArrayBuffer
        sendProgress('Saving redesign results...');
        const resultPath = `${userId}/${uuid}-result.jpg`;
        const resultUploadData = resultBuffer.buffer.slice(
          resultBuffer.byteOffset,
          resultBuffer.byteOffset + resultBuffer.byteLength
        ) as ArrayBuffer;

        const { error: uploadResultError } = await scopedClient
          .storage
          .from('room-results')
          .upload(resultPath, resultUploadData, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadResultError) {
          console.error('Error uploading result image:', uploadResultError);
          sendError('Server error, please try again', 'STORAGE_UPLOAD_ERROR', 500);
          return;
        }

        // Note on URL signing: The 'room-uploads' and 'room-results' buckets are configured as public (public: true in initStorage),
        // so public URLs can be fetched directly via getPublicUrl without needing to generate signed URLs.
        const { data: { publicUrl: originalUrl } } = scopedClient
          .storage
          .from('room-uploads')
          .getPublicUrl(originalPath);

        const { data: { publicUrl: resultUrl } } = scopedClient
          .storage
          .from('room-results')
          .getPublicUrl(resultPath);

        // Step 5: Insert record to generations DB table
        const { data: row, error: insertError } = await scopedClient
          .from('generations')
          .insert({
            user_id: userId,
            room_type: room_type!,
            style: style!,
            palette: palette!,
            notes: notes || null,
            prompt_built: promptBuilt,
            original_url: originalUrl,
            result_url: resultUrl,
            status: 'completed'
          })
          .select()
          .single<GenerationRow>();

        if (insertError) {
          console.error('Error inserting generation record:', insertError);
          sendError('Server error, please try again', 'DATABASE_ERROR', 500);
          return;
        }

        // Revalidate the gallery route so that the UI can automatically pull the updated list
        revalidatePath('/api/gallery');

        // Step 6: Return success
        sendSuccess({
          id: row.id,
          original_url: row.original_url,
          result_url: row.result_url,
          prompt_built: row.prompt_built,
          room_type: row.room_type,
          style: row.style,
          palette: row.palette,
          notes: row.notes,
          status: row.status,
          created_at: row.created_at
        });

      } catch (asyncErr: unknown) {
        console.error('Unexpected error in streaming backend runner:', asyncErr);
        sendError('Server error, please try again', 'UNEXPECTED_ERROR', 500);
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      }
    });

  } catch (error: unknown) {
    console.error('Unexpected server error in /api/generate:', error);
    return apiServerError('Server error, please try again', 'UNEXPECTED_ERROR');
  }
}
