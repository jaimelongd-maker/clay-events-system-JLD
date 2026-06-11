# Clay Events System

Sistema de ingesta y visualización de eventos. Recibe eventos vía HTTP, los procesa de forma asíncrona a través de una cola en Redis y un worker separado, los persiste en MongoDB, y los expone en un dashboard React con métricas y gráficos analíticos (polling cada 5 segundos).

---

## Qué implementé

### Backend (Node.js + TypeScript + Express)

**Endpoints principales:**

- **`POST /events`** — recibe eventos, valida con Zod (incluye límites de metadata basados en estándares web), los encola en Redis. Responde `202 Accepted`; el worker persiste de forma asíncrona.
- **`GET /events`** — lista eventos con filtros opcionales: `eventType`, `userId`, `fromTimestamp`, `toTimestamp`, `limit` (default 20, máximo 1000). Ordena por timestamp descendente.
- **`GET /metrics`** — total de eventos, conteo por tipo, top 3 usuarios más activos. Consultas paralelas.
- **`GET /metrics/timeline?range=24h|7d|30d`** — eventos agrupados por hora (24h) o fecha DD/MM (7d/30d). Datos pre-agregados en MongoDB, listo para graficar.
- **`GET /metrics/users-activity?range=24h|7d`** — top 5 usuarios con 24 buckets horarios (siempre 00:00–23:00, independiente del rango). Detecta patrones horarios de actividad.
- **`GET /metrics/users-distribution`** — top 3 usuarios con desglose de tipos de evento. Responde: WHO hace QUÉ (intersección usuario × tipo).
- **`GET /health`** — verifica MongoDB y Redis en paralelo. `200` si ambos OK, `503` si uno falla.
- **`DELETE /events`** — utilidad de desarrollo: limpia MongoDB y la cola de Redis.

**Worker asíncrono:**
- Proceso separado que consume la cola de Redis con `brpop` (bloquea 5s).
- Valida eventos, persiste con retry (backoff exponencial: 1s → 2s → 3s).
- Descarta malformados sin caerse; loguea errores.
- Crea índices en MongoDB (`eventType`, `userId`, `timestamp`).

**Validación:**
- Zod con límites realistas en metadata (basados en estándares de analytics):
  - `page`: máx 1,000 caracteres (URLs pathname complejas + SPAs)
  - `action`: máx 100 caracteres (estándar Firebase/Amplitude)
  - `component`: máx 200 caracteres (hierarchies React anidadas)
- Filtro de rango: `fromTimestamp <= toTimestamp` validado con `.refine()`.

### Frontend (React + TypeScript + Create React App)

**Componentes y gráficos:**

1. **EventsTable** — tabla de los últimos 20 eventos, filtrable por tipo.
2. **EventsChart** — bar chart de distribución por tipo con color estable.
3. **EventsTimeline** — line chart de actividad en el tiempo.
   - Selector de rango: últimas 24h (por hora), 7 días (por fecha), 30 días (por fecha).
   - Datos del backend (GET `/metrics/timeline`), no calculados en frontend.
4. **UserTypeDistribution** — stacked bar chart de top usuarios × tipos de evento.
   - Responde: ¿qué tipos hace cada usuario?
   - Reutiliza los mismos colores del gráfico de tipos (coherencia visual).
5. **TopUsers** — tabla de top 3 usuarios por cantidad de eventos.
6. **EventForm** — formulario para agregar eventos. Botones rápidos por tipo, carga de seed.

**Filtros:**
- Gráfico de tipos: checkboxes multi-select (qué tipos ver).
- Tabla: dropdown single-select (filtrar por tipo).
- Timeline: dropdown (24h/7d/30d).

**Polling:**
- Cada 5 segundos: `fetchEvents`, `fetchMetrics`.
- Cada cambio de rango o refresh: `fetchTimeline`, `fetchUsersDistribution`.
- Auto-marca nuevos tipos en el gráfico (solo los que llegan por primera vez).

### Tests

- **Backend:** 68 tests, **100% cobertura** en todas las dimensiones (statements, branches, functions, lines).
- **Frontend:** 84 tests, **91.7% statements / 84.84% branches** (100% en 6 de 8 componentes, boilerplate CRA no testeado).
- **Total:** 152 tests pasando.
- Reportes: `npm test -- --coverage` genera HTML navegable en `coverage/lcov-report/index.html`.

**Cobertura detallada:**

Backend:
- `routes`: 100% (132/132 statements, 31/31 branches, 21/21 functions)
- `schemas`: 100% (4/4 statements, 3/3 branches, 1/1 function)
- `worker`: 100% (41/41 statements, 4/4 branches, 6/6 functions)

Frontend:
- `src/components`: 98.3% statements, 93.18% branches (100% en EventsTimeline, EventsChart, EventsTable, FilterSelector, TopUsers, ChartFilter)
- `src`: 81.33% statements (boilerplate CRA: index.tsx, reportWebVitals.ts, types.ts sin cobertura)
- Líneas sin cubrir: EventForm (46, 67), UserTypeDistribution (39) — ramas de edge case


---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js 20, TypeScript, Express |
| Base de datos | MongoDB (driver nativo) |
| Cola | Redis (ioredis) |
| Validación | Zod |
| Frontend | React 18, TypeScript |
| Gráficos | recharts 3.8 |
| HTTP client | axios |
| Tests backend | Jest, Supertest |
| Tests frontend | Jest, React Testing Library |
| Contenedores | Docker, Docker Compose |

---

## Cómo levantar

### Docker Compose (recomendado)

```bash
docker-compose up --build
```

Levanta 5 servicios:
- MongoDB (puerto 27017)
- Redis (puerto 6379)
- Backend HTTP (puerto 3001)
- Worker (sin puerto, asíncrono)
- Frontend (puerto 3002)

El dashboard queda en `http://localhost:3002`.

> **Nota (Windows):** si hay error de puerto bloqueado, ejecutar `net stop winnat`, levantar Docker, `net start winnat`.

### Frontend en desarrollo (con hot reload)

En otra terminal:

```bash
cd frontend
npm install
npm start
```

Abre `http://localhost:3002`. Los cambios en código se reflejan al instante.

### Backend solo en desarrollo (Docker para infraestructura)

```bash
docker-compose up mongodb redis
```

En otra terminal:

```bash
cd backend
npm run dev  # o npm start
```

---

## Variables de entorno

### Backend (en `docker-compose.yml`)

| Variable | Descripción | Valor defecto |
|---|---|---|
| `PORT` | Puerto del servidor HTTP | `3001` |
| `MONGO_URI` | URI de MongoDB | `mongodb://mongodb:27017/clay_events` |
| `REDIS_HOST` | Host de Redis | `redis` |
| `REDIS_PORT` | Puerto de Redis | `6379` |
| `FRONTEND_URL` | Origen del frontend (CORS) | `http://localhost:3002` |

### Frontend (en `frontend/.env` o por defecto)

| Variable | Descripción | Valor defecto |
|---|---|---|
| `REACT_APP_API_URL` | URL base del backend | `http://localhost:3001` |

---

## Cómo correr tests

### Backend

```bash
cd backend
npm test                    # modo watch
npm test -- --coverage      # con reporte HTML
```

Cobertura: `coverage/lcov-report/index.html`

### Frontend

```bash
cd frontend
npm test                               # modo watch
npm test -- --coverage --watchAll=false  # una pasada, con reporte HTML
```

Cobertura: `coverage/lcov-report/index.html`

---

## Estructura del repositorio

```
/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   ├── events.ts
│   │   │   └── metrics.ts        # 4 endpoints de agregación
│   │   ├── schemas/
│   │   │   └── event.schema.ts    # validación Zod con límites
│   │   ├── worker/
│   │   │   └── consumer.ts        # worker asíncrono
│   │   ├── infrastructure/
│   │   │   ├── mongo.ts
│   │   │   └── redis.ts
│   │   └── __tests__/
│   ├── Dockerfile
│   ├── tsconfig.json
│   ├── tsconfig.build.json        # config de build para producción
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── EventsTable.tsx
│   │   │   ├── EventsChart.tsx
│   │   │   ├── EventsTimeline.tsx       # con selector de rango
│   │   │   ├── UserTypeDistribution.tsx # stacked bar
│   │   │   ├── ChartFilter.tsx
│   │   │   ├── FilterSelector.tsx
│   │   │   ├── TopUsers.tsx
│   │   │   ├── EventForm.tsx
│   │   │   └── __tests__/
│   │   ├── api.ts                 # fetchEvents, fetchMetrics, fetchTimeline, fetchUsersDistribution
│   │   ├── types.ts
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── __tests__/
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── seed-events.json           # 50 eventos distribuidos en 30 días
│
├── docker-compose.yml
├── README.md
├── AI_WORKFLOW.md                 # decisiones técnicas documentadas
├── EMAILS.md                      # correspondencia con TL
└── .gitignore
```

---

## Decisiones técnicas clave

**MongoDB driver nativo** en lugar de Mongoose — control total, menos abstracción, mejor para este volumen.

**Zod en lugar de otra librería** — inferencia de tipos TypeScript, validación en runtime, esquemas compoables.

**Agregación en MongoDB** — los gráficos no traen eventos crudos; el backend devuelve datos ya agrupados. Más eficiente (y más correcto arquitectónicamente).

**Polling sobre WebSockets** — para el volumen de una demo, polling cada 5s es más simple, suficiente y sin complejidad de conexión.

**Límites de metadata** — basados en estándares reales (Firebase Analytics 40 chars, Amplitude 256, HTTP spec 2,083). No al azar.

**Color estable por tipo** — el primer tipo que llega siempre tiene el mismo color en todos los gráficos (coherencia visual).

Para detalles sobre cada decisión y aprendizajes, ver `AI_WORKFLOW.md`.

---

## Notas

- **`DELETE /events` es destructivo** — borra todos los eventos. Solo para desarrollo local.
- **Seed de datos:** 50 eventos con timestamps distribuidos en los últimos 30 días. Carga desde el botón "Cargar datos de prueba" en el formulario.
- **Retry del worker:** 3 intentos con backoff (1s, 2s, 3s). Después descarta el evento y loguea.
- **Índices:** creados automáticamente al arrancar el worker.
- **CORS:** cerrado al origen del frontend. `FRONTEND_URL` configurable en `docker-compose.yml`.

---

## Métricas finales

| Métrica | Backend | Frontend | Combinado |
|---|---|---|---|
| **Tests** | 68  | 84  | **152 tests** |
| **Statements** | 100% (177/177) | 91.7% | **95.8%** |
| **Branches** | 100% (38/38) | 84.84% | **92.4%** |
| **Functions** | 100% (28/28) | 87.83% | **93.9%** |
| **Lines** | 100% (166/166) | 93.1% | **96.5%** |

*Nota sobre cobertura frontend: el 91.7% refleja cobertura real sobre componentes. Las 3 líneas sin cubrir (EventForm 46, 67 y UserTypeDistribution 39) son guardias defensivas contra estados imposibles en uso real, no código paths críticos. Tres archivos generados automáticamente por Create React App no están testeados:

- `index.tsx` — entry point que monta React. Es infraestructura de arranque, no lógica de negocio.
- `reportWebVitals.ts` — utilidad default de CRA para medir performance. No es código nuestro.
- `types.ts` — solo interfaces y tipos TypeScript. No genera código ejecutable, Jest no puede testearlo.

---

## Qué quedó fuera (y por qué)

- **Paginación cursor-based:** `GET /events` devuelve fijo 20 (configurable hasta 1000). Para producción habría que paginar con cursor.
- **Autenticación:** fuera de alcance.
- **WebSockets:** polling cada 5s es suficiente para este volumen.
- **Persistencia de filtros:** estado en memoria. Para producción, localStorage o servidor.

---

## Auditoría técnica y mejoras

**Post-implementación,** tras alcanzar 142 tests pasando con 100% cobertura en backend, 
realicé auditoría de mejores prácticas. Identificué 5 áreas menores (no funcionales, 
pero mejorables) y las corregí antes de entregar:

| Área | Problema | Solución |
|---|---|---|
| Magic strings | `'events:queue'` en 2 archivos | Crear `constants.ts` compartido |
| Magic numbers | Límites (20, 1000, 3) hardcodeados | PAGINATION, AGGREGATION en constants |
| Type-safety | `axios.get()` sin tipos genéricos | Agregar interfaces y `axios.get<T>()` |
| Fallback UI | "Top 5 usuarios" vs backend (máx 3) | Usar `MAX_TOP_USERS = 3` |
| Manejo de errores | `alert()` vs `setState()` inconsistente | Extender patrón React a todos los errores |

Detalles técnicos en `AI_WORKFLOW.md` (sección "Auditoría post-implementación").

Resultado: Código más mantenible, type-safe, y con un único punto de verdad para constantes.

---

## Seguridad

**Rate limiting por endpoint** (express-rate-limit):
- POST /events: 60 req/min
- DELETE /events: 5 req/min
- GET /events y GET /metrics*: 120 req/min

Previene: inundación de Redis, destrucción masiva de datos, consultas repetidas.

**Headers HTTP estándar** (helmet):
Protege contra: MIME sniffing, clickjacking, XSS, man-in-the-middle.

**MongoDB injection:**
Protegido automáticamente por Zod. Todo input se valida en tipado estricto antes de llegar a MongoDB.

Detalles técnicos en `AI_WORKFLOW.md` (sección "Auditoría de seguridad").
---

---

## Preguntas de screening

### 1. ¿Qué fue lo más difícil de implementar y cómo lo resolviste?

Los 4 gráficos complejos con agregación MongoDB. La dificultad no fue la sintaxis, sino entender cómo fluía la data desde MongoDB hasta recharts. Hacer debugging visual es diferente que un error de consola.

Lo que ayudó fue separar la lógica en capas: primero validar que MongoDB devolvía los datos correctos con `db.collection.aggregate()`, luego verificar que el endpoint Express los devolvía sin transformar, finalmente armar el componente React sabiendo que la data era confiable.

### 2. Si tuvieras 4 horas más, ¿qué mejorarías primero y por qué?

Tres cosas:

En primer lugar un logging estructurado. Porque en producción se necesita poder trackear una request completa sin estar pegado a los logs.

Segundo, una dead letter queue. porque ahora tenemos el problema de que si el worker muere entre sacar el evento de Redis e insertarlo en MongoDB, el evento desaparece.

Tercero, idempotencia en POST /events. Porque ahora si el cliente reintenta por timeout, el evento se duplica en MongoDB. 

### 3. ¿En qué parte del código la IA te ayudó más? ¿En qué parte te confundió o te dio algo incorrecto?

Lo que más me ayudó fue armar la estructura inicial del frontend. No tuve que perder tiempo escribiendo componentes desde cero. Eso me dejó enfocado en la lógica real.

Pero hay momentos que me confundieron. Uno fue cuando testeaba componentes de React. El test falló y empezó a intentar corregir el código cuando el error era que había ejecutado el comando incorrecto para Jest. Tuve que detenerlo y hacer el test yo mismo, e informarle el error para que no lo volviera a cometer.

Otro momento fue cuando pedí un cambio puntual y empezó a gastar demasiados tokens innecesarios. Le detuve y replantée el prompt siendo más específico, indicando el archivo exacto que debía modificar. Eso resolvió el problema.

### 4. ¿Cómo sabrías que tu módulo de ingesta está fallando en producción?

Hay cuatro cosas que monitorearía, en orden de qué falla primero.

Lo más inmediato es el error rate en POST /events. Si Redis está caído, el endpoint devuelve 500 al instante. Eso es la primera señal de que algo rompió, antes de que la queue ni siquiera tenga oportunidad de acumularse.

Segundo, si la queue de Redis crece sin procesarse. Un "LLEN events:queue" te dice el tamaño. Si sube, significa el worker está caído o muy lento.

Tercero, logs del worker con errores de retry agotado. Eso significa eventos se están perdiendo y es crítico.

Cuarto, latencia entre POST y GET. Aunque hay que considerar que el sistema es intencionalmente asíncrono, POST devuelve 202 sin garantía de cuándo aparece en GET. Por lo que hay que generar un eventId para correlacionar la request.

En producción usaría alertas automáticas en CloudWatch o Datadog para el error rate del endpoint y el tamaño de la queue.

### 5. ¿Hubo algún test que la IA generó mal o que tuviste que corregir? ¿Qué pasaba?

Sí, varios casos. Cuando implementé los filtros de GET /events, Claude generó tests para cada filtro por separado — eventType, userId, rango de timestamp — pero no se le ocurrió testear combinando múltiples filtros juntos. Tuve que solicitarle que lo haga.

En GET /metrics pasó algo diferente. Generó tests para casos extremos (total de eventos = 0, topUsers retornando solo 2), pero un test estaba afectando al siguiente. El countDocumentsMock quedaba configurado del test anterior y lo rompía todo. Tuve que limpiar los mocks entre tests con jest.clearAllMocks().

Finalmente, cuando agregué los límites de caracteres para metadata, faltaban tests de casos límites: string exactamente en el límite, un carácter más allá, campos vacíos, valores null. Eso lo encontré en la auditoría de cobertura.

Lo que vi es que Claude genera bien los casos obvios, pero no piensa en qué puede salir mal en casos límites y también puede generar problemas en sus tests sin darse cuenta como el caso de GET /metrics

