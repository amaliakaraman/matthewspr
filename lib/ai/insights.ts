import { claude, MODEL_SMART, MODEL_BALANCED } from './claude';
import type { Account, Snapshot, Post } from '@/lib/supabase/types';

export interface InsightInput {
  account: Account;
  currentSnapshots: Array<Snapshot & { posts: Post[] }>;
  previousSnapshots: Array<Snapshot & { posts: Post[] }>;
  periodLabel: string;
  notes?: string;
}

export interface InsightOutput {
  headline: string;
  summary_md: string;
  wins: string[];
  watchouts: string[];
  recommendations: Array<{
    platform: string;
    action: string;
    rationale: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  per_platform: Array<{
    platform: string;
    one_liner: string;
    delta_pct: number | null;
  }>;
  callouts: Array<{ label: string; value: string; tone: 'good' | 'bad' | 'neutral' }>;
}

const SYSTEM = `You are a senior social-media analyst working for a personal brand strategist.

You analyze bi-weekly snapshots of social/podcast metrics and write tight, decisive insights for the brand owner. You speak directly, you call out what changed and why it matters, and you give specific actions — not generic platitudes.

Voice rules:
- No filler ("This period was great!"). State numbers.
- One sentence per insight. No hedging.
- Compare to prior period when data exists; flag anomalies (≥30% change).
- Be opinionated. If something dropped, say what to do about it.
- Reference specific platforms by name.

Output MUST be valid JSON matching the InsightOutput schema. No prose outside the JSON.`;

export async function generateInsight(input: InsightInput): Promise<InsightOutput> {
  const summarize = (arr: typeof input.currentSnapshots) =>
    arr.map((s) => ({
      platform: s.platform,
      followers: s.followers,
      growth: s.growth,
      views: s.views,
      impressions: s.impressions,
      likes: s.likes,
      profile_visits: s.profile_visits,
      downloads: s.downloads,
      top_posts: (s.posts || []).slice(0, 5).map((p) => ({
        title: p.title?.slice(0, 60),
        views: p.views,
        likes: p.likes,
        comments: p.comments,
        follows: p.follows
      }))
    }));

  const userMsg = `Account: ${input.account.label} (${input.account.tag})
Period: ${input.periodLabel}
${input.notes ? `Owner notes: ${input.notes}\n` : ''}

CURRENT SNAPSHOT:
${JSON.stringify(summarize(input.currentSnapshots), null, 2)}

PRIOR SNAPSHOT (for comparison):
${JSON.stringify(summarize(input.previousSnapshots), null, 2)}

Write a strategic insight report as JSON:
{
  "headline": "ONE punchy sentence summarizing this period",
  "summary_md": "2-3 short paragraphs in markdown",
  "wins": ["specific win 1", "specific win 2"],
  "watchouts": ["specific concern 1"],
  "recommendations": [
    {"platform": "instagram", "action": "specific action", "rationale": "why", "impact": "high"}
  ],
  "per_platform": [
    {"platform": "instagram", "one_liner": "what happened here in 1 sentence", "delta_pct": 12.5}
  ],
  "callouts": [
    {"label": "Top reel", "value": "45k views (Apr 28)", "tone": "good"}
  ]
}`;

  const res = await claude().messages.create({
    model: MODEL_SMART,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }]
  });

  const txt = (res.content[0] as { type: string; text?: string }).text || '{}';
  const jsonMatch = txt.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}') as InsightOutput;
  return parsed;
}

export interface RecapCopyInput {
  account: Account;
  periodLabel: string;
  platformSummary: Array<{
    platform: string;
    followers: number | null;
    growth: number | null;
    topPost?: { title?: string; views?: number; likes?: number };
  }>;
}

export async function generateRecapCopy(input: RecapCopyInput): Promise<{
  cover_subtitle: string;
  cover_callout: string;
  per_platform_taglines: Record<string, string>;
  meeting_talking_points: string[];
}> {
  const res = await claude().messages.create({
    model: MODEL_BALANCED,
    max_tokens: 1200,
    system:
      'You write punchy, brand-voice copy for social-media recap reports. ' +
      'Voice: confident, specific, no fluff. Maximum 12 words per tagline.',
    messages: [
      {
        role: 'user',
        content: `Account: ${input.account.label} (${input.account.tag})
Period: ${input.periodLabel}
Data: ${JSON.stringify(input.platformSummary)}

Return JSON:
{
  "cover_subtitle": "one phrase under the title",
  "cover_callout": "one bold quote-style stat",
  "per_platform_taglines": {"instagram": "tagline", "tiktok": "tagline", ...},
  "meeting_talking_points": ["3-5 bullets to read aloud in the meeting"]
}`
      }
    ]
  });
  const txt = (res.content[0] as { type: string; text?: string }).text || '{}';
  const match = txt.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : '{}');
}

export async function generateContentStrategy(input: {
  account: Account;
  recentPosts: Array<{ platform: string; title?: string; views?: number; likes?: number }>;
}): Promise<{
  themes_working: string[];
  themes_underperforming: string[];
  next_post_ideas: Array<{ platform: string; hook: string; format: string }>;
}> {
  const res = await claude().messages.create({
    model: MODEL_SMART,
    max_tokens: 1500,
    system:
      'You are a content strategist for a personal brand. You spot pattern winners and write specific next-post ideas. No generic advice.',
    messages: [
      {
        role: 'user',
        content: `Brand: ${input.account.label}
Recent top-performing posts:
${JSON.stringify(input.recentPosts, null, 2)}

Return JSON:
{
  "themes_working": ["theme 1 — why it's working", ...],
  "themes_underperforming": ["theme 1 — why it's flat", ...],
  "next_post_ideas": [
    {"platform": "instagram", "hook": "first 5 words", "format": "Reel / Carousel / Photo"}
  ]
}`
      }
    ]
  });
  const txt = (res.content[0] as { type: string; text?: string }).text || '{}';
  const match = txt.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : '{}');
}
