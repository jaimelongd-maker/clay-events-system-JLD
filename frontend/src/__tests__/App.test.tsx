import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { fetchEvents, fetchMetrics, fetchTimeline, fetchUsersDistribution } from '../api';
import { EventItem, Metrics } from '../types';

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('../api', () => ({
  fetchEvents:            jest.fn(),
  fetchMetrics:           jest.fn(),
  postEvent:              jest.fn(),
  deleteAllEvents:        jest.fn(),
  fetchTimeline:          jest.fn().mockResolvedValue([]),
  fetchUsersDistribution: jest.fn().mockResolvedValue([]),
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart:    ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  LineChart:   ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar:         ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Line:        () => null,
  Cell:        () => null,
  XAxis:       () => null,
  YAxis:       () => null,
  CartesianGrid: () => null,
  Tooltip:     () => null,
  Legend:      () => null,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockEvent: EventItem = {
  _id: 'abc123',
  eventType: 'click',
  userId: 'user-1',
  sessionId: 'session-1',
  timestamp: 1749500000000,
  metadata: { page: '/home', action: 'click_button', component: 'button' },
};

const mockMetrics: Metrics = {
  totalEvents: 3,
  eventsByType: { click: 2, view: 1 },
  topUsers: [{ userId: 'user-1', count: 2 }],
};

const emptyMetrics: Metrics = { totalEvents: 0, eventsByType: {}, topUsers: [] };

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockedFetchEvents             = jest.mocked(fetchEvents);
const mockedFetchMetrics            = jest.mocked(fetchMetrics);
const mockedFetchTimeline           = jest.mocked(fetchTimeline);
const mockedFetchUsersDistribution  = jest.mocked(fetchUsersDistribution);

// Wait for the full initial load to propagate to the DOM.
// The second act() flushes the cascading auto-mark effect (setSelectedTypesForChart)
// that fires after metrics updates, so no state update escapes act().
const waitForInitialLoad = async () => {
  await waitFor(() => screen.getByText(/Total: \d+ eventos/i));
  await act(async () => {});
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('App – render', () => {
  beforeEach(() => {
    mockedFetchEvents.mockResolvedValue([mockEvent]);
    mockedFetchMetrics.mockResolvedValue(mockMetrics);
    mockedFetchTimeline.mockResolvedValue([]);
    mockedFetchUsersDistribution.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  it('renders the dashboard title', async () => {
    render(<App />);
    await waitForInitialLoad();

    expect(screen.getByText('Clay Events Dashboard')).toBeInTheDocument();
  });

  it('shows total event count after data loads', async () => {
    render(<App />);
    await waitForInitialLoad();

    expect(screen.getByText('Total: 3 eventos')).toBeInTheDocument();
  });

  it('calls fetchEvents on mount', async () => {
    render(<App />);

    await waitForInitialLoad();
    expect(mockedFetchEvents).toHaveBeenCalledWith(undefined);
  });

  it('calls fetchMetrics on mount', async () => {
    render(<App />);

    await waitForInitialLoad();
    expect(mockedFetchMetrics).toHaveBeenCalledTimes(1);
  });

  it('renders event rows returned by the API', async () => {
    render(<App />);
    await waitForInitialLoad();

    expect(screen.getByText('click_button')).toBeInTheDocument();
  });
});

describe('App – error handling', () => {
  beforeEach(() => {
    mockedFetchTimeline.mockResolvedValue([]);
    mockedFetchUsersDistribution.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('shows error message when fetchEvents rejects', async () => {
    mockedFetchEvents.mockRejectedValue(new Error('Network error'));
    mockedFetchMetrics.mockRejectedValue(new Error('Network error'));

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('Error al cargar datos del servidor')).toBeInTheDocument()
    );
  });

  it('clears error message on a successful polling cycle after a failure', async () => {
    jest.useFakeTimers();

    mockedFetchEvents.mockRejectedValueOnce(new Error('fail'));
    mockedFetchMetrics.mockRejectedValueOnce(new Error('fail'));

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('Error al cargar datos del servidor')).toBeInTheDocument()
    );

    // Next polling cycle succeeds
    mockedFetchEvents.mockResolvedValueOnce([]);
    mockedFetchMetrics.mockResolvedValueOnce(emptyMetrics);

    await act(async () => { jest.advanceTimersByTime(5000); });

    await waitFor(() =>
      expect(screen.queryByText('Error al cargar datos del servidor')).not.toBeInTheDocument()
    );
  });
});

describe('App – table filter', () => {
  beforeEach(() => {
    mockedFetchEvents.mockResolvedValue([]);
    mockedFetchMetrics.mockResolvedValue(mockMetrics);
    mockedFetchTimeline.mockResolvedValue([]);
    mockedFetchUsersDistribution.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  it('calls fetchEvents with the selected event type', async () => {
    render(<App />);

    // Wait for options to be populated from loaded metrics
    await waitFor(() => screen.getByRole('option', { name: 'click' }));

    // Use getByLabelText to target the table filter specifically (avoids ambiguity
    // with the EventsTimeline range <select aria-label="Rango de tiempo">)
    userEvent.selectOptions(screen.getByLabelText('Filtrar por tipo:'), 'click');

    await waitFor(() =>
      expect(mockedFetchEvents).toHaveBeenCalledWith('click')
    );
  });

  it('calls fetchEvents with undefined when filter is reset to "Todos"', async () => {
    render(<App />);

    await waitFor(() => screen.getByRole('option', { name: 'click' }));

    const tableFilter = screen.getByLabelText('Filtrar por tipo:');

    userEvent.selectOptions(tableFilter, 'click');
    await waitFor(() => expect(mockedFetchEvents).toHaveBeenCalledWith('click'));

    userEvent.selectOptions(tableFilter, '');
    await waitFor(() =>
      // fetchEvents is called with (selectedTypeForTable || undefined); '' coerces to undefined
      expect(mockedFetchEvents).toHaveBeenCalledWith(undefined)
    );
  });
});

describe('App – polling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedFetchEvents.mockResolvedValue([]);
    mockedFetchMetrics.mockResolvedValue(emptyMetrics);
    mockedFetchTimeline.mockResolvedValue([]);
    mockedFetchUsersDistribution.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('polls fetchEvents again after 5 seconds', async () => {
    render(<App />);

    await waitFor(() => expect(mockedFetchEvents).toHaveBeenCalledTimes(1));

    await act(async () => { jest.advanceTimersByTime(5000); });

    await waitFor(() => expect(mockedFetchEvents).toHaveBeenCalledTimes(2));
  });

  it('stops polling after the component unmounts (no memory leak)', async () => {
    const { unmount } = render(<App />);

    await waitFor(() => expect(mockedFetchEvents).toHaveBeenCalledTimes(1));

    unmount();

    await act(async () => { jest.advanceTimersByTime(5000); });

    // Call count must stay at 1 — clearInterval ran on unmount
    expect(mockedFetchEvents).toHaveBeenCalledTimes(1);
  });
});
