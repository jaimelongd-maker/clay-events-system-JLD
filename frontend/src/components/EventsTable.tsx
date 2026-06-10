import React from 'react';
import { EventItem } from '../types';

interface Props {
  events: EventItem[];
}

const EventsTable: React.FC<Props> = ({ events }) => (
  <table className="events-table">
    <thead>
      <tr>
        <th>Event Type</th>
        <th>User ID</th>
        <th>Timestamp</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      {events.length === 0 && (
        <tr>
          <td colSpan={4} className="empty">No hay eventos</td>
        </tr>
      )}
      {events.map(event => (
        // _id es estable: React puede identificar cada fila aunque el orden cambie
        // con el polling cada 5s. Usar el índice haría que React re-renderizara
        // toda la tabla en cada actualización aunque los datos no cambiasen.
        <tr key={event._id}>
          <td><span className="badge">{event.eventType}</span></td>
          <td>{event.userId}</td>
          <td>{new Date(event.timestamp).toLocaleString()}</td>
          <td>{event.metadata.action}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default EventsTable;
