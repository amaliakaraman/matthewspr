import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNum(n: number | string | null | undefined): string {
  if (n == null || n === '') return '—';
  const num =
    typeof n === 'number' ? n : parseFloat(String(n).replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return String(n);
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

export function pct(a?: number | null, b?: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return ((a - b) / b) * 100;
}

export function trendClass(delta: number | null | undefined): string {
  if (delta == null) return 'text-ink-mute';
  if (delta > 0) return 'text-emerald-400';
  if (delta < 0) return 'text-rose-400';
  return 'text-ink-mute';
}
