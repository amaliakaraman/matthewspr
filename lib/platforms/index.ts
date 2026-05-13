import type { PlatformAdapter } from './types';
import type { PlatformKind } from '@/lib/supabase/types';
import { spotify } from './spotify';
import { captivate } from './captivate';
import { youtube } from './youtube';
import { instagram } from './instagram';
import { tiktok } from './tiktok';
import { linkedin } from './linkedin';
import { x } from './x';

export const PLATFORMS: Record<PlatformKind, PlatformAdapter> = {
  spotify,
  captivate,
  youtube,
  instagram,
  tiktok,
  linkedin,
  x
};

export const PLATFORM_META: Record<
  PlatformKind,
  {
    name: string;
    color: string;
    gradient?: string;
    icon: string;
    fLabel: string;
    metrics: [string, string, string];
    requiresOAuth: boolean;
    docsUrl: string;
  }
> = {
  spotify: {
    name: 'Spotify',
    color: '#1DB954',
    icon: 'spotify',
    fLabel: 'Followers',
    metrics: ['Plays', 'Saves', 'Listeners'],
    requiresOAuth: true,
    docsUrl: 'https://developer.spotify.com/documentation/web-api'
  },
  captivate: {
    name: 'Captivate',
    color: '#00C2A5',
    icon: 'captivate',
    fLabel: 'Subscribers',
    metrics: ['Downloads', 'Plays', 'Episodes'],
    requiresOAuth: false,
    docsUrl: 'https://developers.captivate.fm/'
  },
  youtube: {
    name: 'YouTube',
    color: '#FF0033',
    icon: 'youtube',
    fLabel: 'Subscribers',
    metrics: ['Views', 'Watch Hrs', 'Avg Views'],
    requiresOAuth: true,
    docsUrl: 'https://developers.google.com/youtube/v3'
  },
  instagram: {
    name: 'Instagram',
    color: '#E1306C',
    gradient: 'linear-gradient(135deg,#833AB4,#E1306C,#F77737)',
    icon: 'instagram',
    fLabel: 'Followers',
    metrics: ['Views', 'Likes', 'Avg Watch'],
    requiresOAuth: true,
    docsUrl: 'https://developers.facebook.com/docs/instagram-api'
  },
  tiktok: {
    name: 'TikTok',
    color: '#FE2C55',
    icon: 'tiktok',
    fLabel: 'Followers',
    metrics: ['Views', 'Likes', 'Avg Watch'],
    requiresOAuth: true,
    docsUrl: 'https://developers.tiktok.com/doc/login-kit-web/'
  },
  linkedin: {
    name: 'LinkedIn',
    color: '#0A66C2',
    icon: 'linkedin',
    fLabel: 'Followers',
    metrics: ['Impressions', 'Likes', 'Profile Views'],
    requiresOAuth: true,
    docsUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing/'
  },
  x: {
    name: 'X',
    color: '#FFFFFF',
    icon: 'x',
    fLabel: 'Followers',
    metrics: ['Impressions', 'Likes', 'Profile Visits'],
    requiresOAuth: true,
    docsUrl: 'https://developer.x.com/en/docs/x-api'
  }
};

export function getPlatform(kind: PlatformKind): PlatformAdapter {
  return PLATFORMS[kind];
}
