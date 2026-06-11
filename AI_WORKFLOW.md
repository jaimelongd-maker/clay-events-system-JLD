# AI_WORKFLOW.md

## PROMPTS UTILIZADOS

### Prompt 1: Graceful shutdown en Docker

**Fase:** implementación

**Contexto:** Viniendo de .NET, necesitaba entender cómo limpiar recursos cuando un contenedor Docker se detiene.

**Prompt usado:**
[¿Docker libera recursos automáticamente al detener un contenedor?, en caso de no ser así, dame las alternativas y yo las evalúo]

**Resultado:** Útil directo

**Qué acepté:** Implementar Graceful Shutdown con handlers en SIGTERM para cerrar conexiones a MongoDB y Redis.

**Qué modifiqué o rechacé:** No acepté guardar datos automáticamente al detenerse, lo manejé con transacciones en lugar de autosave.

---

### Prompt 2: Validación con Zod

**Fase:** implementación

**Contexto:** Necesitaba validar eventos en POST /events. En .NET usaba DataAnnotations, en Node necesitaba algo equivalente.

**Prompt usado:**
[Necesito un endpoint que reciba eventos con esta estructura: { eventType, userId, sessionId, timestamp (epoch ms), metadata { page, action, component } }. Dame las 3 mejores alternativas para validación en Node.js, siendo específico en los beneficios de cada una]

**Resultado:** Útil directo

**Qué acepté:** Utilizar Zod porque ofrece seguridad, inferencia de tipos automática y no requiere validaciones adicionales.

**Qué modifiqué o rechacé:** No elegí Joi porque usamos TypeScript. No elegí class-validator por la complejidad de decoradores.

---

### Prompt 3: Límites en metadata para evitar DoS

**Fase:** implementación

**Contexto:** El schema no validaba máximo en los campos de metadata. Permitía strings de miles de caracteres. Necesitaba estándares reales antes de decidir límites.

**Prompt usado:**
[Quiero robustecer el endpoint POST /events para evitar ataques DoS. Necesito que agregues límites a la metadata. ¿Qué límites máximos utilizan plataformas como Firebase Analytics, Amplitude o Segment en campos similares? Dame números reales basados en estándares de la industria]

**Resultado:** Útil directo

**Qué acepté:** Los límites investigados: page máximo 1000, action máximo 100, component máximo 200. Todos basados en estándares reales.

**Qué modifiqué o rechacé:** Los números iniciales que propuso. Investigué más a fondo en estándares de Analytics y RFC de HTTP.

---

### Prompt 4: Agregación en MongoDB vs JavaScript

**Fase:** diseño

**Contexto:** Los gráficos necesitaban datos agrupados por hora, tipo de evento, usuario. Tenía dos opciones: traer eventos crudos al frontend y agrupar en JavaScript, o hacer la agregación en MongoDB.

**Prompt usado:**
[Tengo 10.000 eventos que necesito agrupar por eventType y por rango de fechas para mostrar en gráficos. Compara las opciones de agregar en MongoDB con $group vs traer todos los eventos al frontend y agrupar con JavaScript. Hazme un análisis de transferencia de datos, CPU, latencia y escalabilidad]

**Resultado:** Útil directo

**Qué acepté:** Hacer la agregación en MongoDB. Los números mostraban 10MB vs 100KB en transferencia. Eso decidí.

**Qué modifiqué o rechacé:** La propuesta inicial de tener un solo endpoint de métricas. Creé 3 endpoints especializados en lugar de uno genérico.

---

### Prompt 5: Polling vs WebSockets

**Fase:** diseño

**Contexto:** El dashboard necesitaba actualizarse con nuevos eventos. Tenía que elegir entre WebSockets (conexión persistente) o polling (HTTP cada N segundos).

**Prompt usado:**
[Para un dashboard que muestra 50-100 eventos en tiempo real, compara WebSockets vs polling cada 5 segundos. Considera: latencia, complejidad del servidor, tolerancia a fallos, escalabilidad. Es una demo, no producción a escala masiva]

**Resultado:** Útil directo

**Qué acepté:** Polling cada 5 segundos. Para el volumen de la demo, la latencia de 5s no impacta. WebSocket agrega complejidad de reconexión que no necesito.

**Qué modifiqué o rechacé:** La sugerencia inicial de usar Socket.io. Es innececesaria para una demo simple.

### Prompt 6: MongoDB driver nativo vs Mongoose

**Fase:** Arquitectura

**Contexto:** Claude agregó Mongoose a las dependencias. Necesitaba decidir si lo mantenía o usaba el driver nativo.

**Prompt usado:**
[Me percaté que añadiste Mongoose a los paquetes cuando te comenté en el markdown que no lo hicieras, ¿Debería usar Mongoose o el driver nativo de MongoDB? Para un proyecto pequeño con 50-100 eventos]

**Resultado:** Requirió ajustes

**Qué acepté:** Usar el driver nativo. Control total sobre las queries, menos capas de abstracción.

**Qué modifiqué o rechacé:** Rechacé Mongoose porque para 50-100 eventos, la abstracción de ORM agrega overhead innecesario. Con el driver nativo tengo control total sobre las queries sin complejidad extra.


### Prompt 7: Estructuración de tests

**Fase:** testing

**Contexto:** Necesitaba cobertura completa. Tenía que estructurar tests para validación, worker, endpoints y métricas.

**Prompt usado:**
[Dame un plan de cobertura de tests para: 1) validación Zod de POST /events, 2) lógica del worker, 3) endpoints GET/POST/DELETE, 4) cálculo de métricas. Qué casos límite testear]

**Resultado:** Útil directo

**Qué acepté:** El plan completo. Casos límite bien identificados (campos nulos, arrays vacíos, timestamps inválidos).

**Qué modifiqué o rechacé:** Agregué tests de integración que no había en el plan original.

---

### Prompt 8: Rate limiting y seguridad

**Fase:** Implementación

**Contexto:** Después de tener el código funcional, realicé auditoría de seguridad en endpoints.

**Prompt usado:**
[Revisa los endpoints Express buscando vulnerabilidades: rate limiting faltante, headers de seguridad, inyección MongoDB. Sé específico en qué está vulnerable y cómo arreglarlo]

**Resultado:** Útil directo

**Qué acepté:** Express-rate-limit con límites por riesgo: POST 60/min, DELETE 5/min, GET 120/min. Helmet para headers estándar.

**Qué modifiqué o rechacé:** Los límites iniciales eran muy permisivos. Ajusté el DELETE a 5/min por ser destructivo.

---

### Prompt 9: Auditoría de código limpio

**Fase:** Testing

**Contexto:** Con 142 tests pasando, audité el código buscando malas prácticas que funcionaban pero eran frágiles.

**Prompt usado:**
[Revisar el código buscando: strings mágicos duplicados, números hardcodeados, tipado débil en axios, inconsistencias en manejo de errores. Dame específicamente dónde están y cómo arreglarlo]

**Resultado:** Requirió ajustes

**Qué acepté:** Centralizar constantes (REDIS_KEYS, PAGINATION, AGGREGATION). Agregar tipos genéricos a axios.

**Qué modifiqué o rechacé:** La sugerencia de usar config centralizada en todas partes fue parcial. Solo centralicé lo que tenía sentido.

---

## Decisión más importante basada en IA

Cuando empecé a diseñar los gráficos, primero hice EventsChart, EventsTimeline y TopUsers — todos eran claros de hacer. Después pensé qué más podía mostrar.

Propuse varios gráficos a Claude: UserTypeDistribution (stacked bar de tipos × usuario), UserActivityHeatmap (hora × usuario), un gráfico de sesiones. Para cada uno preguntaba: ¿cuánto trabajo cuesta implementarlo en MongoDB y React? ¿Realmente aporta algo que los otros no dan?

UserActivityHeatmap era más compleja de hacer (24 horas × N usuarios con MongoDB aggregation), pero respondía una pregunta real que ningún otro gráfico contestaba: a qué hora cada usuario está más activo. Eso valía la pena.

Lo importante fue no agregar gráficos porque "sí", sino preguntar si realmente sumaban o si era ruido. Claude ayudó a estructurar la evaluación, pero la decisión fue mía: ¿vale la complejidad por el valor que aporta?
---

## Caso donde rechacé a la IA

El error más importante fue cuando Claude generó el endpoint GET /events con ".limit(20)" hardcodeado. Asumió que la API debería saber cómo presenta el frontend los datos (20 eventos en la tabla). 

Cuando implementé los gráficos, se encontraron con que no podían obtener todos los eventos para agregar — estaban limitados a 20. Eso rompía la lógica de agregación en MongoDB.

Rechacé el diseño y lo cambié: el endpoint debería aceptar un parámetro "?limit=N" (default 20, máximo 1000). Los gráficos usan endpoints de métricas específicos que no limitan.

Aprendizaje: las decisiones de presentación en la UI no deben contaminar el diseño de la API. Claude generó código que funcionaba localmente pero sin criterio arquitectónico. Detectarlo requirió pensar en cómo escalaría.

---

## Aprendizajes del proceso

- Especificar exactamente qué archivo y qué línea cuando le pido cambios a Claude. Si digo "agrega esto en el grafico x" sin contexto, pierdo tiempo en que lo busque. La precisión es crítica.

- La auditoría de código post-implementación debería hacerse durante, no después. Detectar strings mágicos, números hardcodeados, tipado débil a medida que aparecen cuesta menos que un refactor masivo al final.

- La IA es buena ejecutando, no decidiendo, especialmente en contextos donde interviene el criterio humano. Lo vi claramente con la elección de gráficos y diseño: la IA no puede imaginar realmente cómo se ve el sitio, cómo lucen los gráficos, o qué valor le da el usuario final. Ese tipo de decisiones es importante tomarlas uno mismo — la IA acelera la ejecución, no la dirección.

---

## Por qué Claude conversacional, no agentes ni plugins

Consideré alternativas cuando empecé.

Los agentes automatizan tareas, hubieran generado código más rápido. Pero para este desafío específico, donde el criterio técnico era lo central, hubiera perdido visibilidad en decisiones críticas. En caso de un timeline más apretado hubiese generado agentes para componentes basicos.

Los plugins aceleran cosas. Pero agregaban capas de abstracción. Necesitaba entender cada decisión. Un agente genera, yo quería no solo generar sino aprender de cada herramienta utilizada. 

Nota: Usé la extensión de Claude en VS Code durante el desarrollo en modo conversacional.

---

## Números finales

- Backend: 68 tests, 100% cobertura
- Frontend: 84 tests, 91.7% statements / 84.84% branches
- Total: 152 tests
- 7 endpoints, 4 gráficos, 3 filtros independientes
