import { render, screen } from '@testing-library/react';
import EventsTable from '../EventsTable';
import { EventItem } from '../../types';

const makeEvent = (overrides: Partial<EventItem> = {}): EventItem => ({
  _id: 'id-1',
  eventType: 'click',
  userId: 'user-1',
  sessionId: 'session-1',
  timestamp: 1749500000000,
  metadata: { page: '/home', action: 'click_button', component: 'button' },
  ...overrides,
});

describe('EventsTable', () => {
  it('renders column headers', () => {
    render(<EventsTable events={[]} />);

    expect(screen.getByText('Event Type')).toBeInTheDocument();
    expect(screen.getByText('User ID')).toBeInTheDocument();
    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('shows empty message when no events', () => {
    render(<EventsTable events={[]} />);

    expect(screen.getByText('No hay eventos')).toBeInTheDocument();
  });

  it('renders a row for each event', () => {
    const events = [
      makeEvent({ _id: 'a', eventType: 'click', userId: 'user-1' }),
      makeEvent({ _id: 'b', eventType: 'view',  userId: 'user-2' }),
    ];

    render(<EventsTable events={events} />);

    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(screen.getByText('user-2')).toBeInTheDocument();
    expect(screen.getByText('click')).toBeInTheDocument();
    expect(screen.getByText('view')).toBeInTheDocument();
  });

  it('renders the metadata action column', () => {
    render(<EventsTable events={[makeEvent({ metadata: { page: '/home', action: 'scroll_down', component: 'list' } })]} />);

    expect(screen.getByText('scroll_down')).toBeInTheDocument();
  });

  it('formats timestamp as a locale string', () => {
    const event = makeEvent({ timestamp: 1749500000000 });
    render(<EventsTable events={[event]} />);

    const expected = new Date(1749500000000).toLocaleString();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders multiple events without crashing when _id differs', () => {
    const events = [
      makeEvent({ _id: 'x1', userId: 'user-10' }),
      makeEvent({ _id: 'x2', userId: 'user-11' }),
      makeEvent({ _id: 'x3', userId: 'user-12' }),
    ];

    const { container } = render(<EventsTable events={events} />);

    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });
});
