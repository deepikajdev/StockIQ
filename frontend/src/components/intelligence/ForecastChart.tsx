import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildForecastChartData } from '../../utils/intelligence';
import type { ForecastSeries } from '../../types';

interface ForecastChartProps {
  series: ForecastSeries;
  height?: number;
}

/** Actual daily units followed by the documented baseline projection. */
export const ForecastChart: React.FC<ForecastChartProps> = ({ series, height = 280 }) => {
  const data = useMemo(() => buildForecastChartData(series), [series]);
  const boundary = series.points[series.history_days - 1]?.date;

  return (
    <div style={{ width: '100%', height }} aria-label="Daily demand history and forecast">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: string) => v.slice(5)}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10 }}
            label={{ value: 'units / day', angle: -90, position: 'insideLeft', fontSize: 10 }}
          />
          <Tooltip
            formatter={(value: unknown, name: string): [string, string] => [
              value === undefined || value === null ? '—' : `${value} units`,
              name === 'actual' ? 'Actual sales' : 'Baseline projection',
            ]}
          />
          <Legend
            formatter={(value: string) =>
              value === 'actual' ? 'Actual sales' : 'Baseline projection'
            }
          />
          {boundary && (
            <ReferenceLine
              x={boundary}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#64748b' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#1d4ed8"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#b45309"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
