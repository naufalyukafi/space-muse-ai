export interface ValidationError {
  message: string;
  code: string;
  status: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: ValidationError;
}

const ALLOWED_ROOM_TYPES = ['living_room', 'bedroom', 'kitchen', 'bathroom', 'home_office'];
const ALLOWED_STYLES = ['minimalist', 'japandi', 'industrial', 'bohemian', 'scandinavian'];
const ALLOWED_PALETTES = ['neutral', 'warm', 'cool', 'bold'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MIN_SIZE = 50 * 1024; // 50KB
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validates the parameters and image inputs for the generator API endpoint.
 * This runs BEFORE any Supabase or Gemini calls.
 */
export function validateGenerateInput(
  params: {
    room_type: string | null;
    style: string | null;
    palette: string | null;
    notes: string | null;
    room_photo: File | null;
    reuse_image_url: string | null;
  },
  fetchedImage?: {
    buffer: Buffer;
    mimeType: string;
  }
): ValidationResult {
  const { room_type, style, palette, notes, room_photo, reuse_image_url } = params;

  // Check missing params
  if ((!room_photo && !reuse_image_url) || !room_type || !style || !palette) {
    const missing = [];
    if (!room_photo && !reuse_image_url) missing.push('room_photo or reuse_image_url');
    if (!room_type) missing.push('room_type');
    if (!style) missing.push('style');
    if (!palette) missing.push('palette');

    return {
      isValid: false,
      error: {
        message: `Invalid parameters: Missing ${missing.join(', ')}`,
        code: 'INVALID_PARAMS',
        status: 400,
      },
    };
  }

  // Check valid room_type, style, palette constants
  const invalidConstants = [];
  if (!ALLOWED_ROOM_TYPES.includes(room_type)) invalidConstants.push(`room_type (${room_type})`);
  if (!ALLOWED_STYLES.includes(style)) invalidConstants.push(`style (${style})`);
  if (!ALLOWED_PALETTES.includes(palette)) invalidConstants.push(`palette (${palette})`);

  if (invalidConstants.length > 0) {
    return {
      isValid: false,
      error: {
        message: `Invalid parameters: Invalid values for ${invalidConstants.join(', ')}`,
        code: 'INVALID_PARAMS',
        status: 400,
      },
    };
  }

  // Check notes length
  if (notes && notes.length > 200) {
    return {
      isValid: false,
      error: {
        message: 'Notes must be 200 characters or less',
        code: 'NOTES_TOO_LONG',
        status: 400,
      },
    };
  }

  // If fetchedImage details are passed, validate the buffer/mimeType
  if (fetchedImage) {
    const { buffer, mimeType } = fetchedImage;
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return {
        isValid: false,
        error: {
          message: `Unsupported image type (${mimeType}). Only JPEG, PNG, and WebP are allowed.`,
          code: 'INVALID_PARAMS',
          status: 400,
        },
      };
    }
    if (buffer.length > MAX_SIZE) {
      return {
        isValid: false,
        error: {
          message: 'Max file size is 10MB',
          code: 'FILE_TOO_LARGE',
          status: 400,
        },
      };
    }
    if (buffer.length < MIN_SIZE) {
      return {
        isValid: false,
        error: {
          message: 'Image too small or dark',
          code: 'FILE_TOO_SMALL',
          status: 400,
        },
      };
    }
  } else if (room_photo) {
    // Validate the File object directly if no fetchedImage is passed
    if (!ALLOWED_MIME_TYPES.includes(room_photo.type)) {
      return {
        isValid: false,
        error: {
          message: `Invalid parameters: Unsupported image type (${room_photo.type}). Only JPEG, PNG, and WebP are allowed.`,
          code: 'INVALID_PARAMS',
          status: 400,
        },
      };
    }
    if (room_photo.size > MAX_SIZE) {
      return {
        isValid: false,
        error: {
          message: 'Max file size is 10MB',
          code: 'FILE_TOO_LARGE',
          status: 400,
        },
      };
    }
    if (room_photo.size < MIN_SIZE) {
      return {
        isValid: false,
        error: {
          message: 'Image too small or dark',
          code: 'FILE_TOO_SMALL',
          status: 400,
        },
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates the file magic bytes of the image buffer against allowed formats.
 * Allowed formats: JPEG (FF D8 FF), PNG (89 50 4E 47 0D 0A 1A 0A), and WebP (RIFF / WEBP).
 */
export async function validateFileBytes(buffer: Buffer): Promise<boolean> {
  if (buffer.length < 12) {
    return false;
  }
  const header = buffer.subarray(0, 12);

  // JPEG check: FF D8 FF
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    return true;
  }

  // PNG check: 89 50 4E 47 0D 0A 1A 0A
  if (
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4E &&
    header[3] === 0x47 &&
    header[4] === 0x0D &&
    header[5] === 0x0A &&
    header[6] === 0x1A &&
    header[7] === 0x0A
  ) {
    return true;
  }

  // WebP check: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    header[0] === 0x52 && // R
    header[1] === 0x49 && // I
    header[2] === 0x46 && // F
    header[3] === 0x46 && // F
    header[8] === 0x57 && // W
    header[9] === 0x45 && // E
    header[10] === 0x42 && // B
    header[11] === 0x50  // P
  ) {
    return true;
  }

  return false;
}

