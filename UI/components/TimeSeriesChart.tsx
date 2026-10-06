'use client';

import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';

export interface SeriesPoint {
  /** unix seconds */
  date: number;
  value: number | null;
  /** Optional benchmark on the same scale (drawn as a grey line) */
  compare?: number | null;
  /** Optional extra reference lines, in the order of the chart's `lines` prop */
  lines?: (number | null)[];
}

/** An extra dashed reference line (e.g. one token's price). */
export interface ExtraLine {
  name: string;
  color: string;
}

export const SERIES_COLOR = '#00ff88'; // arca-green — the vault's own series
export const COMPARE_COLOR = '#8b949e'; // neutral grey — a benchmark, never a second brand colour
const AXIS_INK = '#8b949e'; // arca-text-secondary

export const dateLabel = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Area chart with a crosshair tooltip and a screen-reader table. One series, plus an optional
 * `compareName` benchmark read from each point's `compare` (same unit, same axis — never a dual axis).
 * `format` renders values for the axis, tooltip and table; `step` draws a staircase (for running totals).
 */
export function TimeSeriesChart({
  points,
  name,
  compareName,
  format,
  axisFormat = format,
  step = false,
  lines = [],
}: {
  points: SeriesPoint[];
  name: string;
  compareName?: string;
  format: (v: number | null) => string;
  axisFormat?: (v: number) => string;
  step?: boolean;
  lines?: ExtraLine[];
}) {
  const fillId = `fill-${useId().replace(/:/g, '')}`;
  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={compareName ? 0.08 : 0.18} />
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
            domain={compareName ? ['auto', 'auto'] : [0, 'auto']}
            tickFormatter={(v: number) => axisFormat(v)}
            tick={{ fill: AXIS_INK, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<PointTooltip name={name} compareName={compareName} format={format} lines={lines} />}
            cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }}
          />
          {lines.map((line, i) => (
            <Area
              key={line.name}
              type="monotone"
              dataKey={(p: SeriesPoint) => p.lines?.[i] ?? null}
              name={line.name}
              stroke={line.color}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="none"
              connectNulls
              isAnimationActive={false}
              activeDot={false}
            />
          ))}
          {compareName && (
            <Area
              type="monotone"
              dataKey="compare"
              stroke={COMPARE_COLOR}
              strokeWidth={2}
              fill="none"
              connectNulls
              isAnimationActive={false}
              activeDot={{ r: 4, fill: COMPARE_COLOR, stroke: '#12161e', strokeWidth: 2 }}
            />
          )}
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
        <caption>{compareName ? `${name} vs ${compareName}` : name}</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>{name}</th>
            {compareName && <th>{compareName}</th>}
            {lines.map((l) => (
              <th key={l.name}>{l.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{dateLabel(p.date)}</td>
              <td>{format(p.value)}</td>
              {compareName && <td>{format(p.compare ?? null)}</td>}
              {lines.map((l, i) => (
                <td key={l.name}>{format(p.lines?.[i] ?? null)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PointTooltip({
  active,
  payload,
  name,
  compareName,
  format,
  lines,
}: TooltipProps<number, string> & {
  name: string;
  compareName?: string;
  format: (v: number | null) => string;
  lines: ExtraLine[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as SeriesPoint;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-arca-dark px-3 py-2 text-xs shadow-elevated">
      <div className="mb-1 text-arca-text-secondary">{dateLabel(point.date)}</div>
      <TooltipLine color={SERIES_COLOR} value={format(point.value)} label={name} />
      {compareName && <TooltipLine color={COMPARE_COLOR} value={format(point.compare ?? null)} label={compareName} />}
      {lines.map((l, i) => (
        <TooltipLine key={l.name} color={l.color} value={format(point.lines?.[i] ?? null)} label={l.name} />
      ))}
    </div>
  );
}

function TooltipLine({ color, value, label }: { color: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-0.5 w-3 rounded" style={{ background: color }} />
      <span className="font-semibold tabular-nums text-arca-text">{value}</span>
      <span className="text-arca-text-secondary">{label}</span>
    </div>
  );
}
