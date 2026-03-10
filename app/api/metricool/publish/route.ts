import { NextRequest, NextResponse } from 'next/server';

// ── POST /api/metricool/publish ─────────────────────────────────────────────
// Proxy to Metricool API for scheduling posts
// يقرأ Token من متغيرات البيئة (server-side) — لا يحتاج المستخدم إدخال شيء

const METRICOOL_BASE = 'https://app.metricool.com/api';

async function getBlogId(token: string): Promise<string> {
  try {
    const res = await fetch(`${METRICOOL_BASE}/admin/simpleProfiles`, {
      headers: { 'X-Mc-Auth': token },
    });
    if (res.ok) {
      const profiles = await res.json();
      if (Array.isArray(profiles) && profiles.length > 0) {
        return String(profiles[0].id || profiles[0].blogId || '');
      }
    }
  } catch (e) {
    console.error('[Publish] Failed to fetch blogId:', e);
  }
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { post } = body;

    const token = process.env.METRICOOL_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'METRICOOL_API_TOKEN غير موجود في متغيرات البيئة' },
        { status: 400 }
      );
    }

    const blogId = process.env.METRICOOL_BLOG_ID || await getBlogId(token);
    if (!blogId) {
      return NextResponse.json(
        { error: 'لم نتمكن من جلب blogId' },
        { status: 400 }
      );
    }

    if (!post || !post.providers || post.providers.length === 0) {
      return NextResponse.json(
        { error: 'Missing post data or providers' },
        { status: 400 }
      );
    }

    const metricoolPayload = {
      blogId: parseInt(blogId),
      providers: post.providers,
      text: post.text || '',
      date: post.date || new Date().toISOString(),
      mediaUrls: post.mediaUrls || [],
      autoPublish: post.autoPublish !== false,
      ...(post.instagramOptions && { instagramOptions: post.instagramOptions }),
      ...(post.facebookOptions && { facebookOptions: post.facebookOptions }),
      ...(post.twitterOptions && { twitterOptions: post.twitterOptions }),
      ...(post.tiktokOptions && { tiktokOptions: post.tiktokOptions }),
      ...(post.linkedinOptions && { linkedinOptions: post.linkedinOptions }),
      ...(post.youtubeOptions && { youtubeOptions: post.youtubeOptions }),
      ...(post.pinterestOptions && { pinterestOptions: post.pinterestOptions }),
    };

    const response = await fetch(`${METRICOOL_BASE}/scheduler/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mc-Auth': token,
      },
      body: JSON.stringify(metricoolPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Metricool Publish] Error:', response.status, errorText);
      return NextResponse.json(
        { error: `Metricool API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      postId: result.id || result.postId,
      scheduledDate: post.date,
      providers: post.providers,
      message: 'تم جدولة المنشور بنجاح عبر Metricool',
    });
  } catch (error) {
    console.error('[Metricool Publish] Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
