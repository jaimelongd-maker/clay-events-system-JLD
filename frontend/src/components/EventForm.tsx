import { FC, useState } from 'react';
import { postEvent, deleteAllEvents } from '../api';
import seedEvents from '../seed-events.json';
import { EventItem } from '../types';

const EVENT_TYPES = ['click', 'view', 'scroll', 'submit', 'navigate'];

const randomUserId = () => `user-${Math.floor(Math.random() * 10) + 1}`;

// action se auto-genera igual que el eventType (click → "click")
const buildEvent = (eventType: string, userId: string) => ({
  eventType,
  userId,
  sessionId: `session-${Date.now()}`,
  timestamp: Date.now(),
  metadata: { page: '/dashboard', action: eventType, component: 'dashboard-form' },
});

interface Props {
  onEventAdded: () => void;
}

const EventForm: FC<Props> = ({ onEventAdded }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formType, setFormType] = useState('click');
  const [formUserId, setFormUserId] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado del botón de seed: idle | loading | done | error
  const [seedStatus, setSeedStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const handleQuickAdd = async (eventType: string) => {
    try {
      await postEvent(buildEvent(eventType, randomUserId()));
      onEventAdded();
    } catch {
      alert(`Error al agregar evento "${eventType}"`);
    }
  };

  const handleSubmit = async () => {
    if (!formUserId.trim()) {
      setFormError('El User ID es requerido');
      return;
    }
    setIsSubmitting(true);
    try {
      await postEvent(buildEvent(formType, formUserId.trim()));
      onEventAdded();
      setIsOpen(false);
      setFormUserId('');
      setFormError('');
    } catch {
      alert('Error al agregar el evento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setFormError('');
  };

  const handleClearAll = async () => {
    if (!window.confirm('¿Seguro que quieres eliminar todos los eventos y vaciar la cola de Redis? Esta acción no se puede deshacer.')) return;
    try {
      await deleteAllEvents();
      onEventAdded();
    } catch {
      alert('Error al limpiar los datos');
    }
  };

  // Envía los 50 eventos del JSON en paralelo (equivalente a Task.WhenAll)
  const handleSeedLoad = async () => {
    setSeedStatus('loading');
    try {
      await Promise.all(
        (seedEvents as Omit<EventItem, '_id'>[]).map(event => postEvent(event))
      );
      onEventAdded();
      setSeedStatus('done');
      // Vuelve a idle tras 3s para que el mensaje no quede pegado
      setTimeout(() => setSeedStatus('idle'), 3000);
    } catch {
      setSeedStatus('error');
      setTimeout(() => setSeedStatus('idle'), 3000);
    }
  };

  return (
    <>
      <div className="quick-add">
        {EVENT_TYPES.map(type => (
          <button key={type} className="btn-quick" onClick={() => handleQuickAdd(type)}>
            + {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
        <button className="btn-custom" onClick={() => setIsOpen(true)}>
          + Agregar evento personalizado
        </button>
      </div>

      <div className="seed-row">
        <button
          className="btn-seed"
          onClick={handleSeedLoad}
          disabled={seedStatus === 'loading'}
        >
          {seedStatus === 'loading' ? 'Cargando...' : '⬆ Cargar datos de prueba'}
        </button>
        {seedStatus === 'done'  && <span className="seed-msg seed-msg--ok">✓ {seedEvents.length} eventos cargados</span>}
        {seedStatus === 'error' && <span className="seed-msg seed-msg--err">✗ Error al cargar eventos</span>}
        <button className="btn-danger" onClick={handleClearAll}>
          Limpiar todos los datos
        </button>
      </div>

      {isOpen && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Agregar evento personalizado</h3>

            <div className="form-group">
              <label htmlFor="form-event-type">Event Type</label>
              <select id="form-event-type" value={formType} onChange={e => setFormType(e.target.value)}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="form-user-id">User ID</label>
              <input
                id="form-user-id"
                type="text"
                value={formUserId}
                onChange={e => setFormUserId(e.target.value)}
                placeholder="ej: user-42"
              />
            </div>

            {formError && <p className="form-error">{formError}</p>}

            <div className="modal-actions">
              <button className="btn-submit" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Agregando...' : 'Agregar'}
              </button>
              <button className="btn-cancel" onClick={handleClose}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EventForm;
