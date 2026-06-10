import React from 'react';
import { render, screen } from '@testing-library/react';
import EventsChart from '../EventsChart';

// Recharts relies on ResizeObserver and SVG measurement APIs not available in jsdom.
// Replace with lightweight stubs so the component tree can render.
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Cell: ({ fill }: { fill: string }) => <span data-testid="cell" data-fill={fill} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const makeEntry = (name: string, value: number, color: string) => ({ name, value, color });

describe('EventsChart', () => {
  it('shows empty message when data is empty', () => {
    render(<EventsChart data={[]} />);

    expect(screen.getByText('Sin datos para mostrar')).toBeInTheDocument();
  });

  it('does not render the chart when data is empty', () => {
    render(<EventsChart data={[]} />);

    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders the bar chart when data is provided', () => {
    const data = [makeEntry('click', 10, '#4f46e5')];
    render(<EventsChart data={data} />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('does not show the empty message when data is provided', () => {
    const data = [makeEntry('click', 5, '#4f46e5')];
    render(<EventsChart data={data} />);

    expect(screen.queryByText('Sin datos para mostrar')).not.toBeInTheDocument();
  });

  it('renders one Cell per data entry with the correct fill color', () => {
    const data = [
      makeEntry('click',    10, '#4f46e5'),
      makeEntry('view',      6, '#10b981'),
      makeEntry('scroll',    3, '#f59e0b'),
    ];
    render(<EventsChart data={data} />);

    const cells = screen.getAllByTestId('cell');
    expect(cells).toHaveLength(3);
    expect(cells[0]).toHaveAttribute('data-fill', '#4f46e5');
    expect(cells[1]).toHaveAttribute('data-fill', '#10b981');
    expect(cells[2]).toHaveAttribute('data-fill', '#f59e0b');
  });
});
