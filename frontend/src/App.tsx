import { useState, useEffect, useRef } from 'react';
import { EventItem, Metrics } from './types';
import { fetchEvents, fetchMetrics } from './api';
import EventsTable from './components/EventsTable';
import EventsChart from './components/EventsChart';
import ChartFilter from './components/ChartFilter';
import FilterSelector from './components/FilterSelector';
import EventForm from './components/EventForm';
import TopUsers from './components/TopUsers';
import './App.css';

const POLL_INTERVAL_MS = 5000;

// Paleta fija; el color de cada tipo se asigna por orden de aparición y no cambia
const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function App() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ totalEvents: 0, eventsByType: {}, topUsers: [] });

  // Dos filtros completamente independientes:
  // selectedTypesForChart → controla qué barras se ven en el gráfico (multi-select)
  // selectedTypeForTable  → controla qué eventos aparecen en la tabla (single select)
  const [selectedTypesForChart, setSelectedTypesForChart] = useState<string[]>([]);
  const [selectedTypeForTable, setSelectedTypeForTable] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  // Registro de tipos que el usuario ya ha visto al menos una vez. Solo los tipos
  // que aparecen por PRIMERA vez se auto-marcan; los que el usuario destildó no se
  // vuelven a añadir aunque sigan llegando eventos de ese tipo en el polling.
  const knownTypesRef = useRef<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey(k => k + 1);

  // Polling + carga inicial. refreshKey fuerza un fetch inmediato y reinicia el intervalo.
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsData, metricsData] = await Promise.all([
          fetchEvents(selectedTypeForTable || undefined),
          fetchMetrics(),
        ]);
        setEvents(eventsData);
        setMetrics(metricsData);
        setError(null);
      } catch {
        setError('Error al cargar datos del servidor');
      }
    };

    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [selectedTypeForTable, refreshKey]);

  // Auto-marca solo los tipos que aparecen por primera vez en la BD.
  // knownTypesRef actúa como memoria persistente entre renders sin provocar re-renders.
  useEffect(() => {
    const brandNew = Object.keys(metrics.eventsByType).filter(
      t => !knownTypesRef.current.has(t)
    );
    if (brandNew.length > 0) {
      brandNew.forEach(t => knownTypesRef.current.add(t));
      setSelectedTypesForChart(prev => [...prev, ...brandNew]);
    }
  }, [metrics.eventsByType]);

  const allEventTypes = Object.keys(metrics.eventsByType).sort();

  // Color estable por tipo: el tipo que llegó primero siempre tendrá el mismo color
  const colorMap: Record<string, string> = Object.fromEntries(
    allEventTypes.map((t, i) => [t, CHART_COLORS[i % CHART_COLORS.length]])
  );

  // Solo muestra las barras de los tipos que el usuario tiene marcados
  const chartData = allEventTypes
    .filter(type => selectedTypesForChart.includes(type))
    .map(type => ({ name: type, value: metrics.eventsByType[type], color: colorMap[type] ?? '#4f46e5' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="dashboard">
      <header className="header">
        <h1>Clay Events Dashboard</h1>
        <span className="total-badge">Total: {metrics.totalEvents} eventos</span>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="section">
        <h2>Agregar eventos</h2>
        <EventForm onEventAdded={triggerRefresh} />
      </section>

      <section className="section">
        <h2>Eventos por tipo</h2>
        <ChartFilter
          types={allEventTypes}
          selected={selectedTypesForChart}
          colorMap={colorMap}
          onChange={setSelectedTypesForChart}
        />
        <EventsChart data={chartData} />
      </section>

      <section className="section">
        <h2>Top usuarios</h2>
        <TopUsers users={metrics.topUsers} />
      </section>

      <section className="section">
        <h2>Últimos eventos <span className="subtitle">(actualiza cada 5s)</span></h2>
        <div className="table-controls">
          <label htmlFor="table-filter">Filtrar por tipo:</label>
          <FilterSelector
            id="table-filter"
            types={allEventTypes}
            selected={selectedTypeForTable}
            onChange={setSelectedTypeForTable}
          />
        </div>
        <EventsTable events={events} />
      </section>
    </div>
  );
}

export default App;
