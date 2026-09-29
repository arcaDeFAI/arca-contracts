'use client';

import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';

export interface SeriesPoint {
  /** unix seconds */
  date: number;
  value: number | null;
}

const SERIES_COLOR = '#00ff88'; // arca-green — single series, so no legend; the card title names it
const AXIS_INK = '#8b949e'; // arca-text-secondary

export const dateLabel = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * One-series area chart with a crosshair tooltip and a screen-reader table.
 * `format` renders values for the axis, tooltip and table; `step` draws a staircase (for running totals).
 */
export function TimeSeriesChart({
  points,
  name,
  format,
  axisFormat = format,
  step = false,
}: {
  points: SeriesPoint[];
  name: string;
  format: (v: number | null) => string;
  axisFormat?: (v: number) => string;
  step?: boolean;
}) {
  const fillId = `fill-${useId().replace(/:/g, '')}`;
  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.18} />
              <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tickFormatter={dateLabel}
            tick={{ fill: AXIS_INK, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            width={56}
            tickFormatter={(v: number) => axisFormat(v)}
            tick={{ fill: AXIS_INK, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<PointTooltip name={name} format={format} />}
            cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }}
          />
          <Area
            type={step ? 'stepAfter' : 'monotone'}
            dataKey="value"
            stroke={SERIES_COLOR}
            strokeWidth={2}
            fill={`url(#${fillId})`}
            connectNulls
            isAnimationActive={false}
            activeDot={{ r: 4, fill: SERIES_COLOR, stroke: '#12161e', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      <table className="sr-only">
        <caption>{name}</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>{name}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{dateLabel(p.date)}</td>
              <td>{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PointTooltip({ active, payload, name, format }: TooltipProps<number, string> & { name: string; format: (v: number | null) => string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as SeriesPoint;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-arca-dark px-3 py-2 text-xs shadow-elevated">
      <div className="mb-0.5 text-arca-text-secondary">{dateLabel(point.date)}</div>
      <div className="font-semibold tabular-nums text-arca-text">
        {format(point.value)} <span className="font-normal text-arca-text-secondary">{name}</span>
      </div>
    </div>
  );
}
