import { FC } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface ChartEntry {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: ChartEntry[];
}

const EventsChart: FC<Props> = ({ data }) => {
  if (data.length === 0) {
    return <p className="empty">Sin datos para mostrar</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" label={{ value: 'Tipo de evento', position: 'insideBottom', offset: -10 }} />
        <YAxis allowDecimals={false} label={{ value: 'Eventos', angle: -90, position: 'insideLeft', offset: 10 }} />
        <Tooltip formatter={(value) => [value, 'Eventos']} />
        {/* Cell asigna el color de cada barra individualmente */}
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default EventsChart;
