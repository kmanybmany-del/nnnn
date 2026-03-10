// ============================================================
// app/api/generate-video/route.ts  — v6 (MAHWOUS CONTENT ENGINE)
//
// NEW FLOW:
//   1. Generate DIFFERENT content for vertical vs horizontal
//      - Vertical (9:16): شبابي حماسي — تيك توك + ريلز
//      - Horizontal (16:9): ثقافي معلوماتي — يوتيوب
//   2. Upload image ONCE → shared image_asset_id
//   3. Generate 2 DIFFERENT TTS audios (different scripts)
//   4. Generate 2 videos in PARALLEL
//   5. Return generation IDs + both scripts for display
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  uploadImageToHedra,
  generateSharedAudio,
  createHedraVideoWithAssets,
  type VideoAspectRatio,
} from '@/lib/hedraClient';
import { generateVideoContents } from '@/lib/mahwousVideoEngine';
import type { PerfumeData } from '@/lib/types';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

interface VideoGenerationRequest {
  perfumeData: PerfumeData;
  imageUrl: string;        // Story image (9:16) for vertical
  landscapeImageUrl?: string; // Landscape image (16:9) for horizontal — if available
  vibe: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VideoGenerationRequest = await request.json();
    const { perfumeData, imageUrl, landscapeImageUrl } = body;

    if (!perfumeData?.name || !imageUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: perfumeData, imageUrl' },
        { status: 400 }
      );
    }

    if (!process.env.HEDRA_API_KEY) {
      return NextResponse.json(
        { error: 'HEDRA_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    // ── Generate different content for each video ────────────────────────
    console.log('[generate-video] Generating content scripts...');
    const contents = generateVideoContents(perfumeData);

    console.log(`[generate-video] Vertical scenario: ${contents.vertical.scenarioName}`);
    console.log(`[generate-video] Horizontal scenario: ${contents.horizontal.scenarioName}`);

    // ── Step 1: Upload images ────────────────────────────────────────────
    // Use story image for vertical, landscape image for horizontal (if available)
    console.log('[generate-video] Step 1: Uploading image(s)...');
    const verticalImageId = await uploadImageToHedra(imageUrl);

    // If landscape image available, upload it separately for horizontal video
    let horizontalImageId: string;
    if (landscapeImageUrl && landscapeImageUrl !== imageUrl) {
      console.log('[generate-video] Uploading separate landscape image...');
      horizontalImageId = await uploadImageToHedra(landscapeImageUrl);
    } else {
      horizontalImageId = verticalImageId; // fallback to same image
    }

    // ── Step 2: Generate 2 DIFFERENT TTS audios in parallel ─────────────
    console.log('[generate-video] Step 2: Generating 2 TTS audios...');
    const [verticalAudioResult, horizontalAudioResult] = await Promise.allSettled([
      generateSharedAudio(contents.vertical.voiceoverText),
      generateSharedAudio(contents.horizontal.voiceoverText),
    ]);

    if (verticalAudioResult.status === 'rejected' && horizontalAudioResult.status === 'rejected') {
      throw new Error('Both TTS generations failed');
    }

    // ── Step 3: Launch videos with their respective content ─────────────
    console.log('[generate-video] Step 3: Launching videos...');

    const videoPromises: Promise<{ id: string; status: string }>[] = [];
    const videoMeta: Array<{
      aspectRatio: VideoAspectRatio;
      voiceoverText: string;
      scenarioName: string;
      hook: string;
    }> = [];

    // Vertical video (9:16)
    if (verticalAudioResult.status === 'fulfilled') {
      videoPromises.push(
        createHedraVideoWithAssets({
          imageAssetId: verticalImageId,
          audioAssetId: verticalAudioResult.value,
          textPrompt: contents.vertical.videoPrompt,
          aspectRatio: '9:16',
        })
      );
      videoMeta.push({
        aspectRatio: '9:16',
        voiceoverText: contents.vertical.voiceoverText,
        scenarioName: contents.vertical.scenarioName,
        hook: contents.vertical.hook,
      });
    }

    // Horizontal video (16:9)
    if (horizontalAudioResult.status === 'fulfilled') {
      videoPromises.push(
        createHedraVideoWithAssets({
          imageAssetId: horizontalImageId,
          audioAssetId: horizontalAudioResult.value,
          textPrompt: contents.horizontal.videoPrompt,
          aspectRatio: '16:9',
        })
      );
      videoMeta.push({
        aspectRatio: '16:9',
        voiceoverText: contents.horizontal.voiceoverText,
        scenarioName: contents.horizontal.scenarioName,
        hook: contents.horizontal.hook,
      });
    }

    const results = await Promise.allSettled(videoPromises);

    const videos: Array<{
      id: string;
      aspectRatio: VideoAspectRatio;
      status: string;
      error?: string;
      voiceoverText: string;
      scenarioName: string;
      hook: string;
    }> = [];

    results.forEach((result, index) => {
      const meta = videoMeta[index];
      if (result.status === 'fulfilled') {
        videos.push({
          id: result.value.id,
          aspectRatio: meta.aspectRatio,
          status: result.value.status || 'queued',
          voiceoverText: meta.voiceoverText,
          scenarioName: meta.scenarioName,
          hook: meta.hook,
        });
      } else {
        console.error(`[generate-video] ${meta.aspectRatio} failed:`, result.reason);
        videos.push({
          id: '',
          aspectRatio: meta.aspectRatio,
          status: 'failed',
          error: String(result.reason?.message || `${meta.aspectRatio} video generation failed`),
          voiceoverText: meta.voiceoverText,
          scenarioName: meta.scenarioName,
          hook: meta.hook,
        });
      }
    });

    // Add failed TTS entries
    if (verticalAudioResult.status === 'rejected') {
      videos.push({
        id: '',
        aspectRatio: '9:16',
        status: 'failed',
        error: `TTS failed: ${verticalAudioResult.reason?.message || 'Unknown'}`,
        voiceoverText: contents.vertical.voiceoverText,
        scenarioName: contents.vertical.scenarioName,
        hook: contents.vertical.hook,
      });
    }
    if (horizontalAudioResult.status === 'rejected') {
      videos.push({
        id: '',
        aspectRatio: '16:9',
        status: 'failed',
        error: `TTS failed: ${horizontalAudioResult.reason?.message || 'Unknown'}`,
        voiceoverText: contents.horizontal.voiceoverText,
        scenarioName: contents.horizontal.scenarioName,
        hook: contents.horizontal.hook,
      });
    }

    return NextResponse.json({
      videos,
      // Legacy field for backward compatibility
      voiceoverText: contents.vertical.voiceoverText,
    });
  } catch (error: unknown) {
    console.error('[/api/generate-video] Error:', error);
    const message = error instanceof Error ? error.message : 'Video generation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
