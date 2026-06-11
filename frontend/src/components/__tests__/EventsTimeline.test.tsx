import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventsTimeline from '../EventsTimeline';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown }) => (
    <div data-testid="line-chart" data-points={JSON.stringify(data)}>{children}</div>
  ),
  Line: ({ stroke }: { stroke: string }) => (
    <div data-testid="line" data-stroke={stroke} />
  ),
  XAxis:         () => null,
  YAxis:         () => null,
  CartesianGrid: () => null,
  Tooltip:       () => null,
}));

const sampleData = [
  { timeLabel: '2024-01-10 08:00', count: 3 },
  { timeLabel: '2024-01-10 09:00', count: 7 },
];

const defaultProps = {
  data: sampleData,
  range: '24h' as const,
  onRangeChange: jest.fn(),
};

describe('EventsTimeline', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the select with three options', () => {
    render(<EventsTimeline {...defaultProps} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Últimas 24 horas' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Últimos 7 días' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Últimos 30 días' })).toBeInTheDocument();
  });

  it('shows the current range as selected value', () => {
    render(<EventsTimeline {...defaultProps} range="7d" />);

    expect(screen.getByRole('combobox')).toHaveValue('7d');
  });

  it('calls onRangeChange with the new value when the user changes the option', async () => {
    const onRangeChange = jest.fn();
    render(<EventsTimeline {...defaultProps} onRangeChange={onRangeChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), '7d');

    expect(onRangeChange).toHaveBeenCalledWith('7d');
    expect(onRangeChange).toHaveBeenCalledTimes(1);
  });

  it('shows "Sin datos" when data is empty', () => {
    render(<EventsTimeline {...defaultProps} data={[]} />);

    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });

  it('does not render the chart when data is empty', () => {
    render(<EventsTimeline {...defaultProps} data={[]} />);

    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('renders the chart when data is provided', () => {
    render(<EventsTimeline {...defaultProps} />);

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders the Line with the fixed stroke color #4f46e5', () => {
    render(<EventsTimeline {...defaultProps} />);

    expect(screen.getByTestId('line')).toHaveAttribute('data-stroke', '#4f46e5');
  });

  it('pasa el array de datos al gráfico correctamente', () => {
    render(<EventsTimeline {...defaultProps} />);

    const chart = screen.getByTestId('line-chart');
    expect(JSON.parse(chart.getAttribute('data-points') ?? '[]')).toEqual(sampleData);
  });
});
