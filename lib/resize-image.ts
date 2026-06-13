import sharp from 'sharp';

/**
 * Resizes an image buffer so its longest side is at most 1024px,
 * keeping the aspect ratio, and converts the output to JPEG with quality 85.
 * 
 * If the input buffer is already under 200KB, it returns the input as-is
 * to prevent unnecessary double compression.
 */
export async function resizeForGemini(input: Buffer): Promise<Buffer> {
  if (input.length < 200 * 1024) {
    return input;
  }

  return sharp(input)
    .resize({
      width: 1024,
      height: 1024,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}
