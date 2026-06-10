import { render, screen } from '@testing-library/react';
import TopUsers from '../TopUsers';

describe('TopUsers', () => {
  it('shows empty message when the array is empty', () => {
    render(<TopUsers users={[]} />);

    expect(screen.getByText('Sin datos de usuarios')).toBeInTheDocument();
  });

  it('renders one row per user', () => {
    const users = [
      { userId: 'user-1', count: 10 },
      { userId: 'user-2', count: 7 },
      { userId: 'user-3', count: 3 },
    ];

    const { container } = render(<TopUsers users={users} />);

    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('displays each userId', () => {
    const users = [
      { userId: 'user-1', count: 10 },
      { userId: 'user-2', count: 7 },
    ];

    render(<TopUsers users={users} />);

    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(screen.getByText('user-2')).toBeInTheDocument();
  });

  it('displays the event count for each user', () => {
    const users = [
      { userId: 'user-1', count: 10 },
      { userId: 'user-2', count: 7 },
    ];

    render(<TopUsers users={users} />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows rank numbers starting at 1', () => {
    const users = [
      { userId: 'user-1', count: 10 },
      { userId: 'user-2', count: 5 },
    ];

    render(<TopUsers users={users} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not show the empty message when users are provided', () => {
    render(<TopUsers users={[{ userId: 'user-1', count: 5 }]} />);

    expect(screen.queryByText('Sin datos de usuarios')).not.toBeInTheDocument();
  });
});
