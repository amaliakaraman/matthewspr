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
  color = '#4380F3',
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
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#ECEEF1" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#8A909A', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatNum(v)}
          tick={{ fill: '#8A909A', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={{
            background: '#FFFFFF',
            border: '1px solid #ECEEF1',
            borderRadius: 10,
            color: '#15171C',
            fontSize: 12,
            boxShadow: '0 4px 16px rgba(20,23,28,0.08)'
          }}
          labelStyle={{ color: '#8A909A', fontWeight: 600 }}
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
