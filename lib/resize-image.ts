import 'server-only';
import sharp from 'sharp';

/**
 * Resizes an image buffer so its longest side is at most 1024px,
 * keeping the aspect ratio, and converts it to JPEG at quality 85.
 *
 * If the input is already under 200 KB it is returned as-is to avoid
 * unnecessary double-compression.
 *
 * sharp is declared in serverExternalPackages (next.config.ts) so Next.js /
 * Turbopack does NOT bundle it — the Node.js runtime resolves the native
 * libvips binary directly from node_modules at runtime.
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
