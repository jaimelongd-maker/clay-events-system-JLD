import React from 'react';

interface Props {
  users: { userId: string; count: number }[];
}

const TopUsers: React.FC<Props> = ({ users }) => {
  if (users.length === 0) {
    return <p className="empty">Sin datos de usuarios</p>;
  }

  return (
    <table className="events-table">
      <thead>
        <tr>
          <th>#</th>
          <th>User ID</th>
          <th>Eventos</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user, i) => (
          <tr key={user.userId}>
            <td>{i + 1}</td>
            <td>{user.userId}</td>
            <td><span className="total-badge">{user.count}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default TopUsers;
