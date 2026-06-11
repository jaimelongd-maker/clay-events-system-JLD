# EMAILS.md

## Email 1: Inicio del proyecto

**Asunto:** CASO RF-00000 - Clay Events System — Plan inicial

Hola,

Acabo de terminar de leer el enunciado. Entiendo que necesitamos un sistema que:
- Ingeste eventos desde clientes (POST /events con eventType, userId, metadata)
- Los procese de forma asíncrona (no esperar en la request)
- Los persista en MongoDB
- Exponga endpoints de consulta y métricas
- Muestre todo en un dashboard React

Vengo de .NET así que estoy aprendiendo Node/Express/React sobre la marcha, pero tengo clara la arquitectura.

Stack que usaremos:
- Backend: Node.js + TypeScript + Express
- Base de datos: MongoDB
- Queue: Redis
- Frontend: React
- Tests: Jest
- Deploy local: Docker Compose

Librerías que voy a agregar fuera del stack base:
- Zod para validación de esquemas con inferencia automática de tipos
- Supertest para testear rutas Express (por lo que investigué es un estandar en Express)
- express-rate-limit + helmet para seguridad HTTP 
- recharts para gráficos en React

Empiezo este lunes. Mi plan es:
1. Setup (docker-compose, conexiones, healthcheck)
2. POST /events + worker + validación
3. GET /events y endpoints de métricas
4. Frontend + gráficos
5. Tests + auditoría de seguridad

Cualquier duda, aviso.

Saludos,
Jaime Long D.

## Email 2: Decisión técnica

**Asunto:** CASO RF-00000 - Clay Events System — Decisión arquitectónica: agregación en MongoDB, no en React

Hola,

Quiero documentar una decisión importante que tomé al diseñar los endpoints de métricas.

Los gráficos necesitan datos agregados: eventos agrupados por tipo, por hora, por usuario. Tenía dos caminos: traer todos los eventos crudos al frontend y agruparlos en JavaScript, o agrupar en MongoDB con $group y traer datos ya procesados.

Elegí agregación en MongoDB. Los gráficos usan endpoints especializados (GET /metrics/timeline, GET /metrics/users-distribution) que devuelven datos ya agregados.

La diferencia es importante: 10.000 eventos crudos son 10MB de transferencia. Esos mismos datos agregados son 100KB. Además, MongoDB tiene índices y está optimizado para eso. El navegador no.

Si en algún momento tenemos 1M eventos, traerlos todos al frontend directamente no funciona. El navegador se congela intentando hacer reduce() y lodash antes de poder mostrar algo.

Saludos,
Jaime Long D.

## Email 3: Bloqueo o duda

**Asunto:** CASO RF-00000 - Clay Events System - Bug encontrado en graficos

Hola,

Encontré un problema debuggeando los gráficos nuevos. algunos quedaban vacíos con la data del seed y mostraban muy pocos datos.

Claude pensaba que era un problema del seed (datos viejos o mal distribuidos). Investigué eso y no era. Los eventos estaban en mongodb, pero los gráficos no los veían.

Después de revisar el código me percaté: el endpoint GET /events estaba hardcodeado con .limit(20). Claude asumió que la API debería devolver solo 20 eventos porque es lo que muestra la tabla del dashboard. Pero los gráficos necesitan TODOS los eventos para poder agrupar por hora, por tipo, etc. Con limit:20, la agregación en MongoDB no tenía data suficiente y es una mala práctica por lo demás.

La solución fue cambiar el endpoint a aceptar `?limit=N` con default 20 y máximo 1000. Los gráficos usan endpoints de métricas especializados que no limitan — ya devuelven datos agregados directamente desde MongoDB.

Ya está arreglado, todos los gráficos funcionan correctamente.

Saludos,
Jaime Long D.

## Email 4: Avance intermedio 

**Asunto:** CASO RF-00000 - Clay Events System - Progreso: backend funcional, próximos pasos

Hola,

El backend está andando bien. POST /events + worker + validación Zod funcionando, GET /events con filtros, MongoDB con índices, GET /health. Los gráficos básicos también — EventsChart, EventsTimeline y TopUsers mostrando data correctamente. En tests voy en 68 backend (100%), 74 frontend (88.39%), son 142 tests en total.

Lo que falta ahora es seguridad y un par de gráficos más. Necesito agregar seguridad contra ataques DDoS y headers de seguridad estándar con helmet. Además quiero hacer un gráfico de actividad por hora que muestre a qué momento del día cada usuario es más activo.

También tengo algunas deudas técnicas menores que quiero arreglar, me podrías indicar cuando tengas un tiempo para que tengamos una meet corta (5 minutos máx).

Voy a atacar seguridad primero. los gráficos y la limpieza de código vienen después.

Debería estar todo listo para el mañana si no me encuentro con ningún inconveniente.

Saludos,
Jaime Long D.

## Email 5: Entrega

**Asunto:** ENTREGA || CASO RF-00000 - Clay Events System 

Hola,

Hago entrega del requerimiento "RF-00000 - Clay Events System".

Se entregó un sistema completo de ingestión y visualización de eventos en Docker Compose. El backend tiene POST /events para recibir eventos, GET /events con filtros, DELETE /events, GET /health, y cuatro endpoints de métricas que devuelven datos agregados desde MongoDB. El worker corre en su propio proceso consumiendo la cola Redis y persistiendo en MongoDB con reintentos.

El frontend muestra un dashboard con gráfico de tipos de eventos, timeline configurable (24h/7d/30d), top 3 usuarios más activos, heatmap de actividad por hora, y una tabla filtrable de eventos con polling cada 5 segundos.

En seguridad agregué rate limiting por endpoint (5–120 req/min según criticidad), headers defensivos con helmet, y validación de inputs con Zod en todos lados. Los tests quedaron en 152 totales: 68 backend con 100% cobertura, 84 frontend con 91.7% statements y 84.84% branches.

Hay algunas cosas que dejaría para después. Primero, autenticación en DELETE /events — hoy cualquiera puede vaciar la base de datos, necesita un token o algo básico. Segundo, el rate limiter vive en memoria y se resetea si reinicia el proceso — con volumen real habría que ponerlo en Redis. Y tercero, la tabla tiene un límite de 1000 registros — con datos reales necesitaría cursor-based pagination.

Como siempre, toda la documentación relacionada al desarrollo se encuentra en el repositorio.

Quedo disponible a cualquier consulta.

Saludos,
Jaime Long D.
