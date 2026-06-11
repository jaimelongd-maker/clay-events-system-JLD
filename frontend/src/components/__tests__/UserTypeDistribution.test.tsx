import React from 'react';
import { render, screen } from '@testing-library/react';
import UserTypeDistribution from '../UserTypeDistribution';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ name }: { name: string }) => <div data-testid={`bar-${name}`} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const colorMap = { click: '#4f46e5', pageview: '#10b981' };

const sampleData = [
  { userId: 'user-1', types: [{ type: 'click', count: 5 }, { type: 'pageview', count: 3 }] },
  { userId: 'user-2', types: [{ type: 'click', count: 2 }] },
];

describe('UserTypeDistribution', () => {
  it('muestra "Sin datos" cuando no hay datos', () => {
    render(<UserTypeDistribution data={[]} colorMap={colorMap} />);
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });

  it('no muestra "Sin datos" cuando hay datos', () => {
    render(<UserTypeDistribution data={sampleData} colorMap={colorMap} />);
    expect(screen.queryByText('Sin datos')).not.toBeInTheDocument();
  });

  it('renderiza una barra por cada tipo de evento presente', () => {
    render(<UserTypeDistribution data={sampleData} colorMap={colorMap} />);
    expect(screen.getByTestId('bar-click')).toBeInTheDocument();
    expect(screen.getByTestId('bar-pageview')).toBeInTheDocument();
  });

  it('renderiza el BarChart cuando hay datos', () => {
    render(<UserTypeDistribution data={sampleData} colorMap={colorMap} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('rellena con 0 los tipos ausentes para cada usuario', () => {
    // user-2 solo tiene 'click'; 'pageview' debe aparecer como barra con valor 0
    render(<UserTypeDistribution data={sampleData} colorMap={colorMap} />);

    // Ambas barras (click y pageview) deben renderizarse aunque user-2 no tenga pageview
    expect(screen.getByTestId('bar-click')).toBeInTheDocument();
    expect(screen.getByTestId('bar-pageview')).toBeInTheDocument();
  });
});
