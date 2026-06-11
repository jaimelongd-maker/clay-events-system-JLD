import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventForm from '../EventForm';
import { postEvent, deleteAllEvents } from '../../api';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../api', () => ({
  postEvent:        jest.fn(),
  deleteAllEvents:  jest.fn(),
  isRateLimitError: jest.fn().mockReturnValue(false),
}));

// Reduce the seed to 3 events so assertions are simple and runs are fast
jest.mock('../../seed-events.json', () => [
  { eventType: 'click',  userId: 'u1', sessionId: 's1', timestamp: 1, metadata: { page: '/', action: 'click',  component: 'btn' } },
  { eventType: 'view',   userId: 'u2', sessionId: 's2', timestamp: 2, metadata: { page: '/', action: 'view',   component: 'btn' } },
  { eventType: 'scroll', userId: 'u3', sessionId: 's3', timestamp: 3, metadata: { page: '/', action: 'scroll', component: 'btn' } },
]);

// Suppress window.alert and window.confirm (jsdom does not implement them)
window.alert   = jest.fn();
window.confirm = jest.fn();

const mockedPostEvent       = jest.mocked(postEvent);
const mockedDeleteAllEvents = jest.mocked(deleteAllEvents);

const renderForm = () => {
  const onEventAdded = jest.fn();
  render(<EventForm onEventAdded={onEventAdded} />);
  return { onEventAdded };
};

const openModal = () =>
  userEvent.click(screen.getByText('+ Agregar evento personalizado'));

// ── Quick add ─────────────────────────────────────────────────────────────────

describe('Quick add buttons', () => {
  beforeEach(() => mockedPostEvent.mockResolvedValue(undefined));
  afterEach(() => jest.clearAllMocks());

  it('calls postEvent once with eventType "click" and fires onEventAdded', async () => {
    const { onEventAdded } = renderForm();

    userEvent.click(screen.getByText('+ Click'));

    await waitFor(() => expect(mockedPostEvent).toHaveBeenCalledTimes(1));
    expect(mockedPostEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'click' })
    );
    expect(onEventAdded).toHaveBeenCalledTimes(1);
  });
});

// ── Custom event form (modal) ─────────────────────────────────────────────────

describe('Custom event form (modal)', () => {
  beforeEach(() => mockedPostEvent.mockResolvedValue(undefined));
  afterEach(() => jest.clearAllMocks());

  it('shows the modal when the "Agregar evento personalizado" button is clicked', () => {
    renderForm();
    openModal();

    expect(
      screen.getByRole('heading', { level: 3, name: 'Agregar evento personalizado' })
    ).toBeInTheDocument();
  });

  it('shows validation error and does not call postEvent when User ID is empty', async () => {
    renderForm();
    openModal();

    userEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() =>
      expect(screen.getByText('El User ID es requerido')).toBeInTheDocument()
    );
    expect(mockedPostEvent).not.toHaveBeenCalled();
  });

  it('calls postEvent, fires onEventAdded, and closes the modal on valid submit', async () => {
    const { onEventAdded } = renderForm();
    openModal();

    userEvent.type(screen.getByPlaceholderText('ej: user-42'), 'user-5');
    userEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { level: 3, name: 'Agregar evento personalizado' })
      ).not.toBeInTheDocument()
    );
    expect(mockedPostEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'click', userId: 'user-5' })
    );
    expect(onEventAdded).toHaveBeenCalledTimes(1);
  });

  it('closes the modal and clears the validation error when Cancelar is clicked', async () => {
    renderForm();
    openModal();

    // Trigger the validation error first
    userEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => screen.getByText('El User ID es requerido'));

    userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(
      screen.queryByRole('heading', { level: 3, name: 'Agregar evento personalizado' })
    ).not.toBeInTheDocument();
  });
});

// ── Seed load ─────────────────────────────────────────────────────────────────

describe('Seed load', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedPostEvent.mockResolvedValue(undefined);
  });
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('calls postEvent once per seed event and fires onEventAdded', async () => {
    const { onEventAdded } = renderForm();

    userEvent.click(screen.getByText(/Cargar datos de prueba/i));

    // postEvent is invoked synchronously before the Promise.all await, so waitFor
    // could resolve before the async continuation (onEventAdded) runs. Combining
    // both assertions in one waitFor forces it to wait until the full chain settles.
    await waitFor(() => {
      expect(mockedPostEvent).toHaveBeenCalledTimes(3);
      expect(onEventAdded).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the success message after a successful load', async () => {
    renderForm();

    userEvent.click(screen.getByText(/Cargar datos de prueba/i));

    await waitFor(() =>
      expect(screen.getByText('✓ 3 eventos cargados')).toBeInTheDocument()
    );
  });

  it('shows the error message when postEvent rejects', async () => {
    mockedPostEvent.mockRejectedValueOnce(new Error('network error'));
    renderForm();

    userEvent.click(screen.getByText(/Cargar datos de prueba/i));

    await waitFor(() =>
      expect(screen.getByText('✗ Error al cargar eventos')).toBeInTheDocument()
    );
  });
});

// ── Clear all data ────────────────────────────────────────────────────────────

describe('Clear all data', () => {
  afterEach(() => jest.clearAllMocks());

  it('calls deleteAllEvents and fires onEventAdded when the user confirms', async () => {
    (window.confirm as jest.Mock).mockReturnValue(true);
    mockedDeleteAllEvents.mockResolvedValue(undefined);
    const { onEventAdded } = renderForm();

    userEvent.click(screen.getByText('Limpiar todos los datos'));

    await waitFor(() => expect(mockedDeleteAllEvents).toHaveBeenCalledTimes(1));
    expect(onEventAdded).toHaveBeenCalledTimes(1);
  });

  it('does not call deleteAllEvents when the user cancels the confirm dialog', () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    const { onEventAdded } = renderForm();

    userEvent.click(screen.getByText('Limpiar todos los datos'));

    expect(mockedDeleteAllEvents).not.toHaveBeenCalled();
    expect(onEventAdded).not.toHaveBeenCalled();
  });
});
