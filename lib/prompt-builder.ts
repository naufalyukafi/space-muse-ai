export const STYLE_DESCRIPTIONS: Record<string, string> = {
  minimalist: "clean lines, uncluttered space, functional furniture, lots of negative space, simple forms",
  japandi: "Japanese-Scandinavian fusion, natural wood textures, wabi-sabi aesthetic, organic forms, handcrafted details",
  industrial: "exposed brick or concrete walls, metal accents, Edison bulbs, raw materials, dark moody tones",
  bohemian: "layered textiles, eclectic patterns, rattan and macrame, indoor plants, warm earthy colors",
  scandinavian: "hygge aesthetic, light wood, white walls, cozy textures, simple clean forms",
};

export const PALETTE_DESCRIPTIONS: Record<string, string> = {
  neutral: "whites, beiges, warm grays, soft taupes",
  warm: "terracotta, amber, rust, warm browns, sandy tones",
  cool: "sage green, dusty blue, soft lavender, misty tones",
  bold: "deep navy, emerald green, rich burgundy, statement colors",
};

const cache = new Map<string, string>();

export function buildPrompt(
  roomType: string,
  style: string,
  palette: string,
  notes?: string | null
): string {
  const key = `${roomType}|${style}|${palette}|${notes ?? ''}`;
  
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  // Format room type, e.g. "living_room" to "Living Room"
  const formattedRoomType = roomType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  const roomTypeNameLower = formattedRoomType.toLowerCase();

  const styleDesc = STYLE_DESCRIPTIONS[style] || style;
  const paletteDesc = PALETTE_DESCRIPTIONS[palette] || palette;

  let prompt = `${formattedRoomType}:
This is a ${roomTypeNameLower}. Redesign this exact space keeping the same 
wall layout, ceiling height, window positions, and room dimensions. 
If the image focuses on a specific area or furniture setup (like a desk and chair), 
preserve the original position, scale, and placement of those elements.
Apply ${style} style: ${styleDesc}. 
Use color palette: ${paletteDesc}. 
Photorealistic interior design render, professional lighting, 
high quality architectural visualization.`;

  if (notes && notes.trim() !== '') {
    prompt += `\n[Additional requirements: ${notes.trim()}]`;
  }

  cache.set(key, prompt);
  
  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }

  return prompt;
}

