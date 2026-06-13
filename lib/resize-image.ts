import 'server-only';
import { Jimp } from 'jimp';

/**
 * Resizes an image buffer so its longest side is at most 1024px,
 * keeping the aspect ratio, and converts it to JPEG at quality 85.
 *
 * If the input is already under 200 KB it is returned as-is to avoid
 * unnecessary double-compression.
 */
export async function resizeForGemini(input: Buffer): Promise<Buffer> {
  if (input.length < 200 * 1024) {
    return input;
  }

  const image = await Jimp.read(input);
  const width = image.width;
  const height = image.height;

  if (width > 1024 || height > 1024) {
    if (width > height) {
      const newWidth = 1024;
      const newHeight = Math.round((height * 1024) / width);
      image.resize({ w: newWidth, h: newHeight });
    } else {
      const newHeight = 1024;
      const newWidth = Math.round((width * 1024) / height);
      image.resize({ w: newWidth, h: newHeight });
    }
  }

  return image.getBuffer('image/jpeg', { quality: 85 });
}
