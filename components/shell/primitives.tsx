import { cn } from '@/lib/utils';

/**
 * Shared light-content primitives matching the Matthews / Theseus design
 * system. These cover the shell anatomy the @matthewsreis/ui package doesn't
 * ship (page header, section label, status pills, progress bars). Token values
 * come straight from the Theseus reference (`design-reference/theme.jsx`).
 */

export function PageHeader({
  title,
  crumb,
  subtitle,
  actions
}: {
  title: string;
  crumb?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-mx-line px-12 pb-[26px] pt-[34px]">
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h1 className="text-[28px] font-bold tracking-[-0.01em] text-mx-title">
          {title}
        </h1>
        {crumb && (
          <span className="text-[15px] font-medium text-mx-muted">{crumb}</span>
        )}
        {subtitle && (
          <span className="text-[15px] font-medium text-mx-secondary">
            {subtitle}
          </span>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function SectionLabel({
  children,
  className,
  right
}: {
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'mb-5 flex items-center justify-between gap-3 border-b border-mx-line pb-3',
        className
      )}
    >
      <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-mx-label">
        {children}
      </span>
      {right}
    </div>
  );
}

type Tone = 'green' | 'amber' | 'red' | 'teal' | 'blue' | 'grey';

const PILL_TONES: Record<Tone, string> = {
  green: 'bg-mx-greenBg text-mx-green',
  amber: 'bg-mx-amberBg text-mx-amber',
  red: 'bg-mx-redBg text-mx-red',
  teal: 'bg-[#E1F4F1] text-mx-teal',
  blue: 'bg-[rgba(67,128,243,0.10)] text-mx-blueDeep',
  grey: 'bg-mx-lineSoft text-mx-secondary'
};

const DOT_TONES: Record<Tone, string> = {
  green: 'bg-mx-dotGreen',
  amber: 'bg-mx-dotAmber',
  red: 'bg-mx-dotRed',
  teal: 'bg-mx-dotTeal',
  blue: 'bg-mx-blue',
  grey: 'bg-mx-dotGrey'
};

export function StatusPill({
  tone = 'grey',
  dot = false,
  children,
  className
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold leading-none',
        PILL_TONES[tone],
        className
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', DOT_TONES[tone])} />
      )}
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'blue',
  className
}: {
  value: number;
  max?: number;
  tone?: 'blue' | 'green' | 'amber' | 'red';
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, max === 0 ? 0 : (value / max) * 100));
  const fill = {
    blue: 'bg-mx-blue',
    green: 'bg-mx-green',
    amber: 'bg-mx-amber',
    red: 'bg-mx-red'
  }[tone];
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-mx-line', className)}
    >
      <div
        className={cn('h-full rounded-full transition-all', fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Avatar({
  name,
  className
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-[rgba(67,128,243,0.10)] text-[13px] font-bold text-mx-blueDeep',
        className
      )}
    >
      {initials || '?'}
    </div>
  );
}

export function ProgressRing({
  value,
  max,
  size = 44,
  stroke = 4,
  tone = 'blue'
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  tone?: 'blue' | 'green';
}) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = max === 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const color = tone === 'green' ? '#1D9669' : '#4380F3';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ECEEF1" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-mx-title">
        {value}/{max}
      </span>
    </div>
  );
}

export function StatCard({
  icon,
  iconClass,
  value,
  label,
  className
}: {
  icon?: React.ReactNode;
  iconClass?: string;
  value: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-[18px] rounded-[14px] border border-mx-line bg-white px-6 py-[22px] shadow-card transition-shadow hover:shadow-cardHover',
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            iconClass || 'bg-[rgba(67,128,243,0.10)] text-mx-blue'
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[28px] font-black leading-none text-mx-title">
          {value}
        </span>
        <span className="text-[14px] font-medium text-mx-secondary">{label}</span>
      </div>
    </div>
  );
}
