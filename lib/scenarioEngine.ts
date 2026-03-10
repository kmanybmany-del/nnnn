// ============================================================
// lib/scenarioEngine.ts — Elite Ad Director (Gemini-powered)
// Generates cinematic prompts, viral scripts, and montage directives
// for premium perfume advertising campaigns.
// ============================================================

import type { PerfumeData } from './types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface VideoScenario {
  platform: 'TikTok' | 'Instagram Reels' | 'YouTube Shorts';
  hook: string;
  action: string;
  voiceover: string;
  cta: string;
}

export interface EliteDirectorOutput {
  cinematic_image_prompts: string[];
  viral_video_script: string;
  montage_directives: {
    sfx: string;
    bgm: string;
    caption_style: string;
    transitions: string;
    color_grade: string;
  };
  scenarios: VideoScenario[];
}

// ── Metricool intel type ────────────────────────────────────────────────────

export interface MetricoolIntel {
  trending_keywords: string[];
  market_vibe: string;
  best_posting_time: string;
  competitor_insights: string;
  top_hashtags: string[];
}

// ── System prompt for Gemini Elite Ad Director ──────────────────────────────

export function buildEliteDirectorPrompt(
  perfumeData: PerfumeData,
  intel?: MetricoolIntel | null
): string {
  const intelSection = intel
    ? `
## METRICOOL MARKET INTELLIGENCE:
- Trending Keywords: ${intel.trending_keywords.join(', ')}
- Market Vibe: ${intel.market_vibe}
- Best Posting Time: ${intel.best_posting_time}
- Competitor Insights: ${intel.competitor_insights}
- Top Hashtags: ${intel.top_hashtags.join(' ')}
`
    : '';

  return `You are an ELITE AD DIRECTOR for luxury Saudi Arabian perfume campaigns.
You create Midjourney-V6 level cinematic image prompts and viral TikTok/Reels scripts.

## PERFUME DETAILS:
- Name: ${perfumeData.name}
- Brand: ${perfumeData.brand}
- Gender: ${perfumeData.gender || 'unisex'}
- Notes: ${perfumeData.notes || 'premium oriental'}
- Description: ${perfumeData.description || ''}
- Price: ${perfumeData.price || ''}
${intelSection}

## YOUR OUTPUT (strict JSON):
{
  "cinematic_image_prompts": [
    "Prompt 1: Ultra-detailed, 8K cinematic shot. [specific scene]. Dramatic golden hour lighting, shallow depth of field, shot on ARRI ALEXA 65, anamorphic lens flare. Perfume bottle ${perfumeData.name} prominently displayed. Style: editorial luxury photography meets Arabian Nights. --ar 9:16 --v 6 --style raw",
    "Prompt 2: ...(different scene, different art style)",
    "Prompt 3: ...(different mood, landscape composition)"
  ],
  "viral_video_script": "A 15-20 second script in SAUDI ARABIC DIALECT (not formal Arabic). Must open with a PSYCHOLOGICAL HOOK that stops scrolling. Include emotional triggers: exclusivity, confidence, identity. The script should feel like a friend recommending a secret, not an ad.",
  "montage_directives": {
    "sfx": "glass clink, fabric swoosh, deep bass drop",
    "bgm": "dark Arabic trap with oud samples, 140 BPM",
    "caption_style": "TikTok kinetic text, gold on dark, Arabic calligraphy font",
    "transitions": "whip pan, zoom through bottle, smoke reveal",
    "color_grade": "warm amber shadows, crushed blacks, gold highlights"
  },
  "scenarios": [
    {
      "platform": "TikTok",
      "hook": "...",
      "action": "...",
      "voiceover": "...",
      "cta": "..."
    },
    {
      "platform": "Instagram Reels",
      "hook": "...",
      "action": "...",
      "voiceover": "...",
      "cta": "..."
    },
    {
      "platform": "YouTube Shorts",
      "hook": "...",
      "action": "...",
      "voiceover": "...",
      "cta": "..."
    }
  ]
}

RESPOND ONLY WITH VALID JSON. No markdown, no explanation.`;
}

// ── Call Gemini for Elite Director output ────────────────────────────────────

export async function generateEliteDirectorContent(
  perfumeData: PerfumeData,
  intel?: MetricoolIntel | null
): Promise<EliteDirectorOutput> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (apiKey) {
    try {
      const prompt = buildEliteDirectorPrompt(perfumeData, intel);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.9,
              topP: 0.95,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(text);
        return parsed as EliteDirectorOutput;
      }
    } catch (err) {
      console.warn('[scenarioEngine] Gemini call failed, using fallback:', err);
    }
  }

  // Fallback: rule-based generation
  return generateFallbackContent(perfumeData);
}

// ── Fallback rule-based generation ──────────────────────────────────────────

function getVibeCategory(perfumeData: PerfumeData): 'floral' | 'oriental' | 'fresh' | 'woody' | 'sweet' {
  const text = `${perfumeData.notes || ''} ${perfumeData.description || ''} ${perfumeData.name}`.toLowerCase();
  if (/rose|jas|flor|ورد|ياسمين|زهر/.test(text)) return 'floral';
  if (/ocean|aqua|fresh|marine|بحر|منعش/.test(text)) return 'fresh';
  if (/wood|cedar|sandal|oud|خشب|عود|صندل/.test(text)) return 'woody';
  if (/vanil|sweet|caramel|حلو|فانيل/.test(text)) return 'sweet';
  return 'oriental';
}

function generateFallbackContent(perfumeData: PerfumeData): EliteDirectorOutput {
  const category = getVibeCategory(perfumeData);

  const categoryStyles: Record<string, { scene: string; mood: string; color: string }> = {
    floral: { scene: 'enchanted rose garden at golden hour', mood: 'romantic ethereal', color: 'soft pink and gold' },
    oriental: { scene: 'opulent Arabian palace with marble and gold', mood: 'mysterious powerful', color: 'deep amber and burgundy' },
    fresh: { scene: 'Mediterranean cliff overlooking turquoise sea', mood: 'invigorating free', color: 'cool blue and silver' },
    woody: { scene: 'ancient cedar forest with shafts of sunlight', mood: 'grounded sophisticated', color: 'warm brown and forest green' },
    sweet: { scene: 'luxurious Parisian patisserie at twilight', mood: 'indulgent glamorous', color: 'rose gold and cream' },
  };

  const style = categoryStyles[category] || categoryStyles.oriental;

  return {
    cinematic_image_prompts: [
      `Ultra-detailed 8K cinematic shot. Saudi man in premium bisht holding ${perfumeData.name} bottle in ${style.scene}. Dramatic rim lighting, smoke wisps, shallow DOF f/1.4. Shot on ARRI ALEXA 65 with Cooke anamorphic lens. ${style.mood} mood. Color palette: ${style.color}. Editorial luxury perfume photography. --ar 9:16 --v 6 --style raw`,
      `Artistic product flat lay. ${perfumeData.name} bottle centered on dark marble surface surrounded by ${category === 'floral' ? 'scattered rose petals' : category === 'oriental' ? 'oud chips and saffron threads' : 'raw ingredients'}. Overhead shot, dramatic side lighting creating long shadows. Vogue Arabia editorial style. ${style.color} color grade. --ar 1:1 --v 6`,
      `Cinematic wide landscape. ${style.scene} with ${perfumeData.name} bottle as foreground element. Golden hour volumetric light rays. Professional fragrance campaign photography, ${style.mood} atmosphere. Film grain, crushed blacks, ${style.color} toning. --ar 16:9 --v 6 --style raw`,
    ],
    viral_video_script: `يا جماعة وش السالفة مع ${perfumeData.name}؟ والله هذا العطر غير! أول ما تشمه تحس بـ${category === 'oriental' ? 'فخامة ما لها حدود' : category === 'floral' ? 'أنك في حديقة ملكية' : category === 'fresh' ? 'انتعاش يخليك تطير' : 'دفء يلف قلبك'}. ${perfumeData.notes ? `المكونات: ${perfumeData.notes}` : 'مكوناته فاخرة من أول نفحة لآخر نفحة'}. صدقني، لو جربته مستحيل ترجع لغيره. ${perfumeData.price ? `وبسعره ${perfumeData.price} يستاهل كل ريال` : 'وسعره يستاهل'}. الرابط في البايو!`,
    montage_directives: {
      sfx: 'glass clink impact, fabric swoosh, deep sub-bass hit, spray mist sound',
      bgm: `dark Arabic trap beat with ${category === 'oriental' ? 'oud and qanun' : category === 'floral' ? 'soft piano and strings' : 'modern synth'} samples, 130-140 BPM`,
      caption_style: 'TikTok kinetic typography, gold text on dark blur, Arabic Naskh font with motion blur transitions',
      transitions: 'whip pan to bottle, zoom through cap, smoke/fog reveal, quick cut montage',
      color_grade: `${style.color} palette, crushed blacks, lifted highlights, film emulation`,
    },
    scenarios: [
      {
        platform: 'TikTok',
        hook: category === 'oriental' ? 'إذا شفت هذا العطر، اشتريه وأنت مغمض!' : `شعور ${category === 'fresh' ? 'الانتعاش' : 'الفخامة'} في زجاجة!`,
        action: 'الشخصية تنظر للكاميرا بجدية ثم تبتسم بثقة وهي ترش العطر.',
        voiceover: `يقولون إن الفخامة لها حدود، لكن مع ${perfumeData.name}، كسرنا كل القواعد.`,
        cta: 'اكتشف سر الجاذبية. الرابط في البايو!',
      },
      {
        platform: 'Instagram Reels',
        hook: 'السر وراء حضوري القوي؟',
        action: 'الشخصية ترتدي ملابس أنيقة وتضع العطر بثقة أمام المرآة.',
        voiceover: `كل مناسبة لها عطرها، و${perfumeData.name} هو عطري لكل لحظة استثنائية.`,
        cta: 'جرب الفخامة. اطلبه الآن.',
      },
      {
        platform: 'YouTube Shorts',
        hook: 'كيف تختار عطرك صح؟',
        action: 'الشخصية تشير إلى مكونات العطر على الشاشة ثم تقرب الزجاجة.',
        voiceover: `عطر ${perfumeData.name} بمكوناته من ${perfumeData.notes || 'أجود المصادر'} هو خيارك الأمثل.`,
        cta: 'لا تتردد، الرابط أول تعليق.',
      },
    ],
  };
}

// ── Legacy export for backward compatibility ────────────────────────────────
export function generateVideoScenarios(perfumeData: PerfumeData, vibe: string): VideoScenario[] {
  const output = generateFallbackContent(perfumeData);
  return output.scenarios;
}
