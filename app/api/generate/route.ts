// ============================================================
// app/api/generate/route.ts
// Mahwous Perfume AI — Image Generation Pipeline v6
//
// STRATEGY (v6): GEMINI FIRST — faster + understands bottle reference
//   Priority 1: Gemini nano-banana-pro-preview (10-15s per image)
//     → Receives real bottle photo + character description
//     → Generates 3D Pixar/Disney style with EXACT bottle
//   Priority 2: FLUX LoRA (fallback if Gemini fails)
//     → Uses MAHWOUS_MAN LoRA for character consistency
//
// WHY GEMINI FIRST:
//   - 10-15s vs 30-120s for FLUX → fits Vercel timeout
//   - Understands reference images natively
//   - Produces exact bottle match from photo reference
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { buildFluxPrompt, buildNegativePrompt, buildGeminiEnhancePrompt } from '@/lib/promptEngine';
import { buildPlatformSpecificPrompt } from '@/lib/mahwousImageEngine';
import type { GenerationRequest } from '@/lib/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// ─── MAHWOUS_MAN LoRA weights ─────────────────────────────────────────────────
const MAHWOUS_LORA_URL =
  'https://v3b.fal.media/files/b/0a90eba7/OiQI7NS6N3neTl50fJHcC_pytorch_lora_weights.safetensors';
const MAHWOUS_TRIGGER = 'MAHWOUS_MAN';

const FAL_KEY_ENV = () => process.env.FAL_KEY ?? '';
const FAL_QUEUE_BASE = 'https://queue.fal.run';
const FAL_MODEL_T2I = 'fal-ai/flux-lora';

// Gemini model name
const GEMINI_MODEL = 'nano-banana-pro-preview';

// ─── Aspect ratio configurations ─────────────────────────────────────────────
const ASPECT_CONFIGS = [
  {
    format: 'story' as const,
    label: 'Instagram Story (9:16)',
    dimensions: { width: 864, height: 1536 },
    imageSize: { width: 864, height: 1536 },
    aspectRatio: '9:16',
    aspectHint: 'VERTICAL PORTRAIT (9:16 tall format, taller than wide)',
  },
  {
    format: 'post' as const,
    label: 'Post Square (1:1)',
    dimensions: { width: 1072, height: 1072 },
    imageSize: { width: 1072, height: 1072 },
    aspectRatio: '1:1',
    aspectHint: 'SQUARE (1:1 equal width and height)',
  },
  {
    format: 'landscape' as const,
    label: 'Twitter / LinkedIn (16:9)',
    dimensions: { width: 1280, height: 720 },
    imageSize: { width: 1280, height: 720 },
    aspectRatio: '16:9',
    aspectHint: 'HORIZONTAL LANDSCAPE (16:9 wide format, wider than tall)',
  },
];

// ─── Fetch image URL and convert to base64 ───────────────────────────────────
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
    return { base64: Buffer.from(buffer).toString('base64'), mimeType };
  } catch {
    return null;
  }
}

// ─── PRIORITY 1: Gemini nano-banana-pro-preview ─────────────────────────────
// Gemini receives:
//   [1] Real bottle photo (if available) — HIGHEST PRIORITY
//   [2] Text prompt with character description + strict bottle instructions
// Returns base64 image or null
async function generateWithGemini(params: {
  prompt: string;
  bottleImageBase64?: string;
  bottleImageUrl?: string;
}): Promise<string | null> {
  const { prompt, bottleImageBase64, bottleImageUrl } = params;
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.warn('[gemini] No GOOGLE_GENERATIVE_AI_API_KEY set');
    return null;
  }

  // Build parts: BOTTLE IMAGE FIRST (highest priority), then prompt
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Add bottle reference image FIRST (Gemini focuses most on first image)
  let hasBottleRef = false;
  if (bottleImageBase64) {
    const base64Data = bottleImageBase64.replace(/^data:image\/\w+;base64,/, '');
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Data } });
    hasBottleRef = true;
    console.log('[gemini] Added user-uploaded bottle image');
  } else if (bottleImageUrl) {
    const bottleImg = await fetchImageAsBase64(bottleImageUrl);
    if (bottleImg) {
      parts.push({ inlineData: { mimeType: bottleImg.mimeType, data: bottleImg.base64 } });
      hasBottleRef = true;
      console.log('[gemini] Added scraped bottle image from URL');
    }
  }

  if (!hasBottleRef) {
    console.log('[gemini] No bottle reference — generating from text description only');
  }

  // Add text prompt AFTER image
  parts.push({ text: prompt });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[gemini] Error ${response.status}: ${errText.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    for (const part of data?.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        console.log('[gemini] Image generated successfully');
        return part.inlineData.data;
      }
    }
    console.warn('[gemini] No image in response');
    return null;
  } catch (err) {
    console.warn('[gemini] Failed:', err);
    return null;
  }
}

// ─── PRIORITY 2: FLUX LoRA (fallback) ───────────────────────────────────────
async function submitToFal(model: string, input: Record<string, unknown>): Promise<string> {
  const falKey = FAL_KEY_ENV();
  if (!falKey) throw new Error('FAL_KEY is not set.');

  const res = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`fal.ai submit error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const requestId = data?.request_id as string | undefined;
  if (!requestId) throw new Error('fal.ai did not return a request_id');
  return requestId;
}

async function pollFalUntilDone(model: string, requestId: string, timeoutMs = 120_000): Promise<string> {
  const falKey = FAL_KEY_ENV();
  if (!falKey) throw new Error('FAL_KEY is not set.');

  const statusUrl = `${FAL_QUEUE_BASE}/${model}/requests/${requestId}/status`;
  const resultUrl = `${FAL_QUEUE_BASE}/${model}/requests/${requestId}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));

    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
    });
    if (!statusRes.ok) continue;

    const status = await statusRes.json();
    const queueStatus: string = status?.status ?? '';

    if (queueStatus === 'COMPLETED') {
      const resultRes = await fetch(resultUrl, {
        headers: { Authorization: `Key ${falKey}` },
      });
      if (!resultRes.ok) throw new Error(`fal.ai result fetch error ${resultRes.status}`);
      const result = await resultRes.json();
      const imageUrl: string | undefined = result?.images?.[0]?.url ?? result?.image?.url;
      if (!imageUrl) throw new Error('fal.ai returned no image URL');
      return imageUrl;
    }

    if (queueStatus === 'FAILED') {
      throw new Error(`fal.ai generation failed: ${status?.error ?? 'Unknown error'}`);
    }
  }

  throw new Error('fal.ai generation timed out after 120 seconds');
}

async function generateWithFlux(params: {
  prompt: string;
  negativePrompt: string;
  loraPath: string;
  imageSize: { width: number; height: number };
}): Promise<string> {
  const { prompt, negativePrompt, loraPath, imageSize } = params;

  const input: Record<string, unknown> = {
    prompt,
    negative_prompt: negativePrompt,
    image_size: imageSize,
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    enable_safety_checker: false,
    output_format: 'jpeg',
    loras: [{ path: loraPath.trim(), scale: 1.0 }],
  };

  const requestId = await submitToFal(FAL_MODEL_T2I, input);
  return await pollFalUntilDone(FAL_MODEL_T2I, requestId);
}

// ─── Generate a single format ─────────────────────────────────────────────────
async function generateFormat(
  request: GenerationRequest,
  ac: typeof ASPECT_CONFIGS[0],
): Promise<{
  format: string;
  label: string;
  dimensions: { width: number; height: number };
  aspectRatio: string;
  url: string | null;
  status: 'COMPLETED' | 'FAILED';
  pipeline: string;
}> {
  const { bottleImageBase64, perfumeData, vibe = '', attire = '', bottleDescription } = request;
  const loraPath = request.loraPath?.trim() || MAHWOUS_LORA_URL;
  const triggerWord = request.loraTriggerWord?.trim() || MAHWOUS_TRIGGER;

  const hasBottleRef = !!(bottleImageBase64 || perfumeData.imageUrl);

  let finalUrl: string | null = null;
  let pipeline = 'none';

  // ══════════════════════════════════════════════════════════════════════════════
  // PRIORITY 1: GEMINI with PLATFORM-SPECIFIC prompts (different scene per format)
  // ══════════════════════════════════════════════════════════════════════════════
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.log(`[generate] Trying Gemini with platform-specific scene (${ac.format})`);

    // Use the new platform-specific prompt engine for varied scenes
    const geminiPrompt = buildPlatformSpecificPrompt({
      perfumeData,
      format: ac.format,
      attire,
      aspectHint: ac.aspectHint,
      bottleDescription,
      hasBottleReference: hasBottleRef,
    });

    const geminiBase64 = await generateWithGemini({
      prompt: geminiPrompt,
      bottleImageBase64,
      bottleImageUrl: perfumeData.imageUrl,
    });

    if (geminiBase64) {
      finalUrl = `data:image/png;base64,${geminiBase64}`;
      pipeline = 'gemini_nano_banana';
      console.log(`[generate] Gemini SUCCESS (${ac.format})`);
    } else {
      console.warn(`[generate] Gemini FAILED (${ac.format}) — trying FLUX fallback`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PRIORITY 2: FLUX LoRA (fallback — slower but reliable for character)
  // ══════════════════════════════════════════════════════════════════════════════
  if (!finalUrl && FAL_KEY_ENV()) {
    try {
      console.log(`[generate] FLUX LoRA fallback (${ac.format})`);
      const fluxPrompt = buildFluxPrompt({
        perfumeData,
        vibe,
        attire,
        aspectHint: ac.aspectHint,
        bottleDescription,
        loraTriggerWord: triggerWord,
        hasBottleReference: false,
      });
      const negativePrompt = buildNegativePrompt();

      const fluxUrl = await generateWithFlux({
        prompt: fluxPrompt,
        negativePrompt,
        loraPath,
        imageSize: ac.imageSize,
      });
      finalUrl = fluxUrl;
      pipeline = 'flux_lora_fallback';
      console.log(`[generate] FLUX fallback SUCCESS (${ac.format})`);
    } catch (err) {
      console.warn(`[generate] FLUX fallback FAILED (${ac.format}):`, err);
    }
  }

  return {
    format: ac.format,
    label: ac.label,
    dimensions: ac.dimensions,
    aspectRatio: ac.aspectRatio,
    url: finalUrl,
    status: finalUrl ? 'COMPLETED' : 'FAILED',
    pipeline,
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body: GenerationRequest = await request.json();

    if (!body.perfumeData?.name?.trim() || !body.perfumeData?.brand?.trim()) {
      return NextResponse.json(
        { error: 'perfumeData.name and perfumeData.brand are required.' },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !FAL_KEY_ENV()) {
      return NextResponse.json(
        { error: 'Neither GOOGLE_GENERATIVE_AI_API_KEY nor FAL_KEY is configured.' },
        { status: 500 }
      );
    }

    // Generate all 3 formats in parallel
    const results = await Promise.all(
      ASPECT_CONFIGS.map((ac) => generateFormat(body, ac))
    );

    const completedImages = results.filter((r) => r.status === 'COMPLETED' && r.url);

    if (completedImages.length === 0) {
      return NextResponse.json(
        { error: 'فشل توليد الصور. يرجى التحقق من مفاتيح API والمحاولة مرة أخرى.' },
        { status: 500 }
      );
    }

    const pipelines = results.map((r) => `${r.format}:${r.pipeline}`).join(', ');
    console.log(`[generate] Pipelines: ${pipelines}`);

    return NextResponse.json({
      status: 'completed',
      images: completedImages.map((img) => ({
        format: img.format,
        label: img.label,
        dimensions: img.dimensions,
        url: img.url,
        aspectRatio: img.aspectRatio,
      })),
      pipeline: results[0]?.pipeline ?? 'unknown',
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[/api/generate] Error:', error);
    const message = error instanceof Error ? error.message : 'Image generation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
