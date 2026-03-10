// ============================================================
// app/api/analyze-bottle/route.ts
// POST /api/analyze-bottle
// Uses Claude Vision to produce a precise textual description
// of the perfume bottle. This description is injected into
// the generation prompt — the key to product fidelity without
// needing ControlNet (Layer 1 of our fidelity strategy).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, perfumeName, brandName } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required.' }, { status: 400 });
    }

    // Strip the data URL prefix to get the raw base64 data
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const mediaTypeMatch = imageBase64.match(/^data:(image\/[a-z]+);base64,/);
    const mediaType = (mediaTypeMatch?.[1] ?? 'image/jpeg') as
      | 'image/jpeg'
      | 'image/png'
      | 'image/webp'
      | 'image/gif';

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: `You are a product photographer describing a perfume bottle for a 3D CGI artist.
Describe the ${perfumeName ?? 'perfume'} by ${brandName ?? 'this brand'} bottle in precise visual terms that a 3D artist can reproduce.

Focus on:
1. Overall bottle shape (cylindrical, rectangular, tapered, angular, round, etc.)
2. Height-to-width proportions (e.g., "tall and slender", "squat and wide")
3. Cap/stopper design and material
4. Glass color and transparency (clear, frosted, tinted, opaque)
5. Label: position, background color, text color, typography style
6. Any unique design elements (cut glass, metallic accents, embossing, etc.)
7. Dominant color palette

Write ONE dense paragraph of 80–120 words. No bullet points. Be specific and visual.
Do NOT include brand opinions or marketing language.`,
            },
          ],
        },
      ],
    });

    const description =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    return NextResponse.json({ description }, { status: 200 });
  } catch (error: unknown) {
    console.error('[/api/analyze-bottle] Error:', error);
    const message = error instanceof Error ? error.message : 'Bottle analysis failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
