import { getAuthContext, initStorage } from '@/lib/supabase-server';
import { buildPrompt } from '@/lib/prompt-builder';
import { generateInteriorDesign } from '@/lib/gemini';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiBadRequest,
  apiServerError
} from '@/lib/api-response';

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

// Allowed constant values for validation
const ALLOWED_ROOM_TYPES = ['living_room', 'bedroom', 'kitchen', 'bathroom', 'home_office'];
const ALLOWED_STYLES = ['minimalist', 'japandi', 'industrial', 'bohemian', 'scandinavian'];
const ALLOWED_PALETTES = ['neutral', 'warm', 'cool', 'bold'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: Request) {
  try {
    await initStorage();

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

    // Check missing params
    if ((!room_photo && !reuse_image_url) || !room_type || !style || !palette) {
      const missing = [];
      if (!room_photo && !reuse_image_url) missing.push('room_photo or reuse_image_url');
      if (!room_type) missing.push('room_type');
      if (!style) missing.push('style');
      if (!palette) missing.push('palette');

      console.log('Validation failed: Missing parameters', { missing });
      return apiBadRequest(`Invalid parameters: Missing ${missing.join(', ')}`);
    }

    // Check valid room_type, style, palette constants
    const invalidConstants = [];
    if (!ALLOWED_ROOM_TYPES.includes(room_type)) invalidConstants.push(`room_type (${room_type})`);
    if (!ALLOWED_STYLES.includes(style)) invalidConstants.push(`style (${style})`);
    if (!ALLOWED_PALETTES.includes(palette)) invalidConstants.push(`palette (${palette})`);

    if (invalidConstants.length > 0) {
      console.log('Validation failed: Invalid constant values', { invalidConstants });
      return apiBadRequest(`Invalid parameters: Invalid values for ${invalidConstants.join(', ')}`);
    }

    // Check notes length
    if (notes && notes.length > 200) {
      console.log('Validation failed: Notes too long', { notesLength: notes.length });
      return apiBadRequest('Notes must be 200 characters or less', 'NOTES_TOO_LONG');
    }

    let imageBuffer: Buffer;
    let mimeType: string;

    const minSize = 50 * 1024; // 50KB
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (room_photo) {
      // Check file mime type
      if (!ALLOWED_MIME_TYPES.includes(room_photo.type)) {
        console.log('Validation failed: Invalid MIME type', {
          fileName: room_photo.name,
          type: room_photo.type
        });
        return apiBadRequest(`Invalid parameters: Unsupported image type (${room_photo.type}). Only JPEG, PNG, and WebP are allowed.`);
      }

      // Check file size (50KB to 10MB)
      if (room_photo.size > maxSize) {
        console.log('Validation failed: File too large', { size: room_photo.size });
        return apiBadRequest('Max file size is 10MB', 'FILE_TOO_LARGE');
      }
      if (room_photo.size < minSize) {
        console.log('Validation failed: File too small', { size: room_photo.size });
        return apiBadRequest('Image too small or dark', 'FILE_TOO_SMALL');
      }

      // Convert file to Buffer
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
        if (!ALLOWED_MIME_TYPES.includes(contentType)) {
          return apiBadRequest(`Unsupported image type (${contentType}). Only JPEG, PNG, and WebP are allowed.`);
        }
        const arrayBuffer = await res.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        mimeType = contentType;

        // Check size on fetched buffer
        if (imageBuffer.length > maxSize) {
          return apiBadRequest('Max file size is 10MB', 'FILE_TOO_LARGE');
        }
        if (imageBuffer.length < minSize) {
          return apiBadRequest('Image too small or dark', 'FILE_TOO_SMALL');
        }
      } catch (fetchErr) {
        console.error('Error fetching reuse image URL:', fetchErr);
        return apiServerError('Error accessing original image for redesign', 'IMAGE_FETCH_ERROR');
      }
    } else {
      return apiBadRequest('Missing room photo or image URL');
    }

    const uuid = crypto.randomUUID();

    // Upload original image to Supabase Storage
    const originalPath = `${userId}/${uuid}-original.jpg`;
    const { error: uploadOrigError } = await scopedClient
      .storage
      .from('room-uploads')
      .upload(originalPath, imageBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadOrigError) {
      console.error('Error uploading original image:', uploadOrigError);
      return apiServerError('Server error, please try again', 'STORAGE_UPLOAD_ERROR');
    }

    const promptBuilt = buildPrompt(room_type, style, palette, notes);

    let resultBuffer: Buffer;
    try {
      resultBuffer = await generateInteriorDesign(imageBuffer, mimeType, promptBuilt);
    } catch (err: unknown) {
      console.error('Gemini generation error:', err);
      const errorMsg = err instanceof Error ? err.message : '';

      if (errorMsg === 'TIMEOUT') {
        return apiError('AI is busy, try again later', 'TIMEOUT', 504);
      }
      if (errorMsg === 'EMPTY_RESPONSE') {
        return apiError('Image could not be processed', 'EMPTY_RESPONSE', 422);
      }
      if (errorMsg.includes('429') || errorMsg.includes('Quota exceeded')) {
        return apiError(
          'AI rate limit or quota exceeded. Please wait a moment before trying again.',
          'RATE_LIMIT_ERROR',
          429
        );
      }
      return apiServerError(`AI Generation failed: ${errorMsg || 'Unknown error'}`, 'GENERATION_ERROR');
    }

    // Upload result image to Supabase Storage
    const resultPath = `${userId}/${uuid}-result.jpg`;
    const { error: uploadResultError } = await scopedClient
      .storage
      .from('room-results')
      .upload(resultPath, resultBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadResultError) {
      console.error('Error uploading result image:', uploadResultError);
      return apiServerError('Server error, please try again', 'STORAGE_UPLOAD_ERROR');
    }

    // Get Public URLs
    const { data: { publicUrl: originalUrl } } = scopedClient
      .storage
      .from('room-uploads')
      .getPublicUrl(originalPath);

    const { data: { publicUrl: resultUrl } } = scopedClient
      .storage
      .from('room-results')
      .getPublicUrl(resultPath);

    // Insert record into generations table
    const { data: row, error: insertError } = await scopedClient
      .from('generations')
      .insert({
        user_id: userId,
        room_type: room_type,
        style: style,
        palette: palette,
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
      return apiServerError('Server error, please try again', 'DATABASE_ERROR');
    }

    // Return completed response
    return apiSuccess({
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

  } catch (error: unknown) {
    console.error('Unexpected server error in /api/generate:', error);
    return apiServerError('Server error, please try again', 'UNEXPECTED_ERROR');
  }
}
