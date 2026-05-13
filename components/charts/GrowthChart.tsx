'use client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { formatNum } from '@/lib/utils';

export interface GrowthPoint {
  date: string;
  followers: number | null;
  growth: number | null;
}

export function GrowthChart({
  data,
  color = '#38BDF8',
  metric = 'followers'
}: {
  data: GrowthPoint[];
  color?: string;
  metric?: 'followers' | 'growth';
}) {
  const gradId = `g-${color.replace(/[^a-z0-9]/gi, '')}-${metric}`;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,.05)" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#6B7596', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatNum(v)}
          tick={{ fill: '#6B7596', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(13,18,48,.95)',
            border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 10,
            color: '#F8FAFF',
            fontSize: 12
          }}
          formatter={(v: number) => formatNum(v)}
        />
        <Area
          type="monotone"
          dataKey={metric}
          stroke={color}
          fill={`url(#${gradId})`}
          strokeWidth={2.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
