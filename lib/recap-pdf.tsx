import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image
} from '@react-pdf/renderer';
import type { Account, PlatformKind, Snapshot, Post } from '@/lib/supabase/types';
import { PLATFORM_META } from '@/lib/platforms';

const PLATFORM_ORDER: PlatformKind[] = [
  'instagram',
  'tiktok',
  'linkedin',
  'x',
  'youtube',
  'spotify',
  'captivate'
];

const styles = StyleSheet.create({
  cover: {
    backgroundColor: '#0D1230',
    color: '#FFFFFF',
    padding: 60,
    height: '100%'
  },
  coverEyebrow: {
    fontSize: 11,
    letterSpacing: 4,
    color: '#7DD3FC',
    textTransform: 'uppercase',
    fontWeight: 600,
    marginBottom: 18
  },
  coverTitle: {
    fontSize: 64,
    fontWeight: 700,
    lineHeight: 1,
    color: '#FFFFFF'
  },
  coverSubTitle: {
    fontSize: 60,
    fontWeight: 700,
    color: '#E1306C',
    marginTop: 6
  },
  coverFooter: {
    marginTop: 16,
    fontSize: 14,
    color: '#A5B4FC'
  },
  coverStatsWrap: {
    marginTop: 80,
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  coverStat: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27315A',
    borderRadius: 14,
    backgroundColor: '#141A45'
  },
  coverStatValue: {
    fontSize: 36,
    fontWeight: 700,
    color: '#FFFFFF'
  },
  coverStatLabel: {
    fontSize: 11,
    color: '#A5B4FC',
    marginTop: 6
  },
  platformPage: {
    backgroundColor: '#FFFFFF',
    color: '#1a1a2e',
    padding: 60,
    height: '100%'
  },
  pHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  pHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  pAccentBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pAccentLetter: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 700
  },
  pTitle: {
    fontSize: 28,
    fontWeight: 700
  },
  pSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4
  },
  pPeriodLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: '#9CA3AF',
    textTransform: 'uppercase'
  },
  pPeriodValue: {
    fontSize: 14,
    fontWeight: 600,
    marginTop: 2
  },
  pHero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
    borderRadius: 14,
    marginBottom: 24
  },
  pHeroLeftLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 2,
    color: '#FFFFFF',
    opacity: 0.85,
    textTransform: 'uppercase'
  },
  pHeroGrowth: {
    fontSize: 46,
    fontWeight: 700,
    color: '#FFFFFF',
    marginTop: 6
  },
  pHeroRightValue: {
    fontSize: 34,
    fontWeight: 700,
    color: '#FFFFFF',
    textAlign: 'right'
  },
  pHeroRightLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 1.5,
    color: '#FFFFFF',
    opacity: 0.85,
    marginTop: 4,
    textAlign: 'right'
  },
  pPostsLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 10
  },
  pPosts: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  pPost: {
    width: '23%',
    marginHorizontal: '1%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden'
  },
  pPostThumb: {
    width: '100%',
    height: 140,
    backgroundColor: '#E5E7EB'
  },
  pPostBody: {
    padding: 8,
    backgroundColor: '#FFFFFF'
  },
  pPostStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  pPostStatLabel: {
    fontSize: 9,
    color: '#6B7280'
  },
  pPostStatValue: {
    fontSize: 9,
    fontWeight: 700,
    color: '#1a1a2e'
  },
  pFooter: {
    position: 'absolute',
    bottom: 24,
    left: 60,
    right: 60,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  pFooterText: {
    fontSize: 9,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.5
  }
});

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}

// `@react-pdf/renderer`'s <Image src> needs a remote URL or a buffer; bare HTTPS
// URLs work fine, but we guard against undefined.
function safeImg(url?: string | null) {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
    return url;
  } catch {
    return undefined;
  }
}

interface RecapData {
  template: 'km-full' | 'tmmp-full' | 'combined' | 'custom';
  period: string;
  accounts: Account[];
  snapshotsByAccount: Record<string, Array<Snapshot & { posts: Post[] }>>;
}

export function RecapPdfDocument({ template, period, accounts, snapshotsByAccount }: RecapData) {
  const target =
    template === 'km-full'
      ? accounts.filter((a) => a.tag === 'KM')
      : template === 'tmmp-full'
      ? accounts.filter((a) => a.tag === 'TMMP')
      : accounts;

  const title =
    template === 'km-full'
      ? 'KM'
      : template === 'tmmp-full'
      ? 'TMMP'
      : 'KM + TMMP';

  return (
    <Document>
      <Page size={[864, 1152]}>
        <View style={styles.cover}>
          <Text style={styles.coverEyebrow}>{period || 'Bi-weekly Recap'}</Text>
          <Text style={styles.coverTitle}>{title}</Text>
          <Text style={styles.coverSubTitle}>Social Recap.</Text>
          <Text style={styles.coverFooter}>
            Generated by KM Socials · Command Center
          </Text>
          <View style={styles.coverStatsWrap}>
            {target.flatMap((a) => {
              const snaps = snapshotsByAccount[a.id] || [];
              const followers = snaps.reduce((s, sn) => s + (sn.followers || 0), 0);
              const growth = snaps.reduce((s, sn) => s + (sn.growth || 0), 0);
              return [
                <View key={`f-${a.id}`} style={styles.coverStat}>
                  <Text style={styles.coverStatValue}>{fmt(followers)}</Text>
                  <Text style={styles.coverStatLabel}>
                    {a.label} · footprint
                  </Text>
                </View>,
                <View key={`g-${a.id}`} style={styles.coverStat}>
                  <Text style={styles.coverStatValue}>
                    {growth >= 0 ? '+' : ''}
                    {fmt(growth)}
                  </Text>
                  <Text style={styles.coverStatLabel}>
                    {a.label} · growth
                  </Text>
                </View>
              ];
            })}
          </View>
        </View>
      </Page>

      {target.flatMap((a) => {
        const snaps = snapshotsByAccount[a.id] || [];
        return PLATFORM_ORDER.flatMap((platform) => {
          const snap = snaps.find((s) => s.platform === platform);
          if (!snap || (!snap.followers && (!snap.posts || snap.posts.length === 0))) return [];
          const meta = PLATFORM_META[platform];
          const accent =
            platform === 'x' ? '#000000' : meta.color;
          const letter = meta.name[0].toUpperCase();
          return [
            <Page key={`${a.id}-${platform}`} size={[864, 1152]}>
              <View style={styles.platformPage}>
                <View style={styles.pHeader}>
                  <View style={styles.pHeaderLeft}>
                    <View style={[styles.pAccentBox, { backgroundColor: accent }]}>
                      <Text style={styles.pAccentLetter}>{letter}</Text>
                    </View>
                    <View>
                      <Text style={styles.pTitle}>
                        {a.tag} · {meta.name}
                      </Text>
                      <Text style={styles.pSubtitle}>{a.label}</Text>
                    </View>
                  </View>
                  <View>
                    <Text style={styles.pPeriodLabel}>Period</Text>
                    <Text style={styles.pPeriodValue}>{period || '—'}</Text>
                  </View>
                </View>

                <View style={[styles.pHero, { backgroundColor: accent }]}>
                  <View>
                    <Text style={styles.pHeroLeftLabel}>Followers gained</Text>
                    <Text style={styles.pHeroGrowth}>
                      {snap.growth != null
                        ? `${snap.growth >= 0 ? '+' : ''}${fmt(snap.growth)}`
                        : '—'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.pHeroRightValue}>
                      {snap.followers != null ? fmt(snap.followers) : '—'}
                    </Text>
                    <Text style={styles.pHeroRightLabel}>
                      Total {meta.fLabel}
                    </Text>
                  </View>
                </View>

                <Text style={styles.pPostsLabel}>
                  Top performing · {meta.name}
                </Text>
                <View style={styles.pPosts}>
                  {(snap.posts || []).slice(0, 4).map((post, i) => {
                    const img = safeImg(post.thumb_blob_url || post.media_url);
                    return (
                      <View key={i} style={styles.pPost}>
                        {img ? (
                          <Image src={img} style={styles.pPostThumb} />
                        ) : (
                          <View style={styles.pPostThumb} />
                        )}
                        <View style={styles.pPostBody}>
                          {post.views != null && (
                            <View style={styles.pPostStatRow}>
                              <Text style={styles.pPostStatLabel}>Views</Text>
                              <Text style={styles.pPostStatValue}>
                                {fmt(post.views)}
                              </Text>
                            </View>
                          )}
                          {post.likes != null && (
                            <View style={styles.pPostStatRow}>
                              <Text style={styles.pPostStatLabel}>Likes</Text>
                              <Text style={styles.pPostStatValue}>
                                {fmt(post.likes)}
                              </Text>
                            </View>
                          )}
                          {post.downloads != null && (
                            <View style={styles.pPostStatRow}>
                              <Text style={styles.pPostStatLabel}>
                                Downloads
                              </Text>
                              <Text style={styles.pPostStatValue}>
                                {fmt(post.downloads)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.pFooter}>
                  <Text style={styles.pFooterText}>{a.label}</Text>
                  <Text style={styles.pFooterText}>
                    {meta.name} · {period}
                  </Text>
                </View>
              </View>
            </Page>
          ];
        });
      })}
    </Document>
  );
}
