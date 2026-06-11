import { FC } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type Range = '24h' | '7d' | '30d';

interface Props {
  data: Array<{ timeLabel: string; count: number }>;
  range: Range;
  onRangeChange: (range: Range) => void;
}

const LINE_COLOR = '#4f46e5';

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '24h', label: 'Últimas 24 horas' },
  { value: '7d',  label: 'Últimos 7 días'   },
  { value: '30d', label: 'Últimos 30 días'  },
];

const EventsTimeline: FC<Props> = ({ data, range, onRangeChange }) => (
  <div>
    <select
      value={range}
      onChange={e => onRangeChange(e.target.value as Range)}
      aria-label="Rango de tiempo"
    >
      {RANGE_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>

    {data.length === 0 ? (
      <p className="empty">Sin datos</p>
    ) : (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timeLabel"
            label={{ value: range === '24h' ? 'Hora' : 'Día', position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            allowDecimals={false}
            label={{ value: 'Eventos', angle: -90, position: 'insideLeft', offset: 10 }}
          />
          <Tooltip
            formatter={(value) => [value, 'Eventos']}
            labelFormatter={(label) => (range === '24h' ? `Hora: ${label}` : `Día: ${label}`)}
          />
          <Line type="monotone" dataKey="count" stroke={LINE_COLOR} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )}
  </div>
);

export default EventsTimeline;
