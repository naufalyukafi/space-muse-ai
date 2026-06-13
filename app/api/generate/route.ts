import { getAuthContext, initStorage } from '@/lib/supabase-server';
import { buildPrompt } from '@/lib/prompt-builder';
import { generateInteriorDesign } from '@/lib/gemini';
import { validateGenerateInput } from '@/lib/validate';
import { revalidatePath } from 'next/cache';
import {
  apiError,
  apiUnauthorized,
  apiBadRequest,
  apiServerError
} from '@/lib/api-response';
import { resizeForGemini } from '@/lib/resize-image';
import { createHash } from 'crypto';

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

type GenerationSuccessResult = Omit<GenerationRow, 'user_id'>;

// Module-level in-memory cache to track active generation requests.
// Limitation: Since this is in-memory, it is scoped to a single Vercel function instance/container.
const inFlight = new Map<string, Promise<GenerationSuccessResult>>();

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

    // Generate deduplication key based on SHA-256 hash of: userId + roomType + style + palette + file size in bytes (original)
    const hashInput = `${userId}-${room_type}-${style}-${palette}-${imageBuffer.length}`;
    const hash = createHash('sha256').update(hashInput).digest('hex');

    // Check for in-flight duplicate requests
    if (inFlight.has(hash)) {
      console.log(`[API] Duplicate request detected for hash ${hash}. Joining in-flight generation.`);
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      const sendProgress = (stepMessage: string) => {
        writer.write(
          encoder.encode(JSON.stringify({ status: 'progress', message: stepMessage }) + '\n')
        );
      };

      const sendSuccess = (data: GenerationSuccessResult) => {
        writer.write(
          encoder.encode(JSON.stringify({ status: 'success', data }) + '\n')
        );
      };

      const sendError = (message: string, code: string, statusCode: number) => {
        writer.write(
          encoder.encode(JSON.stringify({ status: 'error', message, code, statusCode }) + '\n')
        );
      };

      (async () => {
        try {
          sendProgress('Joining in-progress redesign generation...');
          const result = await inFlight.get(hash);
          if (result) {
            sendSuccess(result);
          } else {
            throw new Error('EMPTY_RESPONSE');
          }
        } catch (err: unknown) {
          console.error('[API] Shared in-flight promise rejected:', err);
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (errorMsg === 'TIMEOUT') {
            sendError('AI is busy, try again later', 'TIMEOUT', 504);
          } else if (errorMsg === 'EMPTY_RESPONSE') {
            sendError('Image could not be processed', 'EMPTY_RESPONSE', 422);
          } else if (errorMsg === 'STORAGE_UPLOAD_ERROR') {
            sendError('Server error, please try again', 'STORAGE_UPLOAD_ERROR', 500);
          } else if (errorMsg === 'DATABASE_ERROR') {
            sendError('Server error, please try again', 'DATABASE_ERROR', 500);
          } else if (errorMsg.includes('429') || errorMsg.includes('Quota exceeded')) {
            sendError(
              'AI rate limit or quota exceeded. Please wait a moment before trying again.',
              'RATE_LIMIT_ERROR',
              429
            );
          } else {
            sendError(`AI Generation failed: ${errorMsg || 'Unknown error'}`, 'GENERATION_ERROR', 500);
          }
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
    }

    // Task 1: Server-side image resize before Gemini
    try {
      imageBuffer = await resizeForGemini(imageBuffer);
      mimeType = 'image/jpeg';
    } catch (resizeErr) {
      console.error('[API] Failed to resize image buffer:', resizeErr);
      return apiServerError('Error processing image', 'RESIZE_ERROR');
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sendProgress = (stepMessage: string) => {
      writer.write(
        encoder.encode(JSON.stringify({ status: 'progress', message: stepMessage }) + '\n')
      );
    };

    const sendSuccess = (data: GenerationSuccessResult) => {
      writer.write(
        encoder.encode(JSON.stringify({ status: 'success', data }) + '\n')
      );
    };

    const sendError = (message: string, code: string, statusCode: number) => {
      writer.write(
        encoder.encode(JSON.stringify({ status: 'error', message, code, statusCode }) + '\n')
      );
    };

    // Create the shared generation promise
    const generatePromise = (async (): Promise<GenerationSuccessResult> => {
      // Step 1: Initialize storage client
      sendProgress('Preparing storage...');
      await initStorage();

      const uuid = crypto.randomUUID();
      const originalPath = `${userId}/${uuid}-original.jpg`;
      const promptBuilt = buildPrompt(room_type!, style!, palette!, notes);

      // Step 2 & 3: Upload original image & generate redesign in parallel
      sendProgress('Uploading original room photo & redesigning room with Gemini AI...');

      let uploadSucceeded = false;
      let uploadError: unknown = null;
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
          throw new Error('STORAGE_UPLOAD_ERROR');
        }

        if (uploadSucceeded) {
          console.log('Gemini failed after upload succeeded, cleaning up original image...');
          try {
            await scopedClient.storage.from('room-uploads').remove([originalPath]);
          } catch (cleanupErr) {
            console.error('Failed to clean up orphaned original image:', cleanupErr);
          }
        }
        throw err;
      }

      if (!resultBuffer) {
        throw new Error('EMPTY_RESPONSE');
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
        throw new Error('STORAGE_UPLOAD_ERROR');
      }

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
        throw new Error('DATABASE_ERROR');
      }

      // Revalidate the gallery route so that the UI can automatically pull the updated list
      revalidatePath('/api/gallery');

      return {
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
      };
    })();

    // Store the promise in-flight cache
    inFlight.set(hash, generatePromise);

    // Process asynchronously in background and resolve stream chunks
    (async () => {
      try {
        const result = await generatePromise;
        sendSuccess(result);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Unexpected error in streaming backend runner:', err);
        if (errorMsg === 'TIMEOUT') {
          sendError('AI is busy, try again later', 'TIMEOUT', 504);
        } else if (errorMsg === 'EMPTY_RESPONSE') {
          sendError('Image could not be processed', 'EMPTY_RESPONSE', 422);
        } else if (errorMsg === 'STORAGE_UPLOAD_ERROR') {
          sendError('Server error, please try again', 'STORAGE_UPLOAD_ERROR', 500);
        } else if (errorMsg === 'DATABASE_ERROR') {
          sendError('Server error, please try again', 'DATABASE_ERROR', 500);
        } else if (errorMsg.includes('429') || errorMsg.includes('Quota exceeded')) {
          sendError(
            'AI rate limit or quota exceeded. Please wait a moment before trying again.',
            'RATE_LIMIT_ERROR',
            429
          );
        } else {
          sendError(`AI Generation failed: ${errorMsg || 'Unknown error'}`, 'GENERATION_ERROR', 500);
        }
      } finally {
        inFlight.delete(hash);
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
