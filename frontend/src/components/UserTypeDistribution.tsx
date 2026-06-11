import { FC } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface UserTypeDatum {
  userId: string;
  types: Array<{ type: string; count: number }>;
}

interface Props {
  data: UserTypeDatum[];
  colorMap: Record<string, string>;
}

const UserTypeDistribution: FC<Props> = ({ data, colorMap }) => {
  if (data.length === 0) {
    return <p className="empty">Sin datos</p>;
  }

  const allTypes = Array.from(new Set(data.flatMap(u => u.types.map(t => t.type)))).sort();

  const chartData = data.map(user => {
    const entry: Record<string, string | number> = { userId: user.userId };
    user.types.forEach(t => { entry[t.type] = t.count; });
    allTypes.forEach(type => { if (entry[type] === undefined) entry[type] = 0; });
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="userId" />
        <YAxis allowDecimals={false} label={{ value: 'Eventos', angle: -90, position: 'insideLeft', offset: 10 }} />
        <Tooltip />
        <Legend />
        {allTypes.map(type => (
          <Bar key={type} dataKey={type} stackId="a" fill={colorMap[type] ?? '#4f46e5'} name={type} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default UserTypeDistribution;
