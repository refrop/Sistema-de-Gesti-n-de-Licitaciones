# Sistema de Gestión de Licitaciones

## 1. Encabezado y acceso rápido

Gestión de licitaciones de principio a fin: creación de propuestas con productos y presupuesto, documento PDF en Supabase Storage, envío real por correo con adjunto, máquina de estados con historial y trazabilidad completa de correos. Backend desplegado en Vercel y conectado a Supabase; frontend pendiente (fases 8-9).

**Demo:** https://sistema-de-gesti-n-de-licitaciones.vercel.app · **Health:** [/api/health](https://sistema-de-gesti-n-de-licitaciones.vercel.app/api/health) · **Docs API:** `/api/docs` ⏳ (fase 9)

**Credenciales demo (solo evaluación, cámbialas en cualquier entorno real):**

| Rol | Email | Password |
|---|---|---|
| admin | `admin@example.com` | `CambiaEstaClave123!` |
| user | `user@example.com` | `CambiaEstaClave123!` |

### Estado por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Repo, schema + migraciones, seed, `/api/health`, despliegue Vercel, spike Storage + Resend | ✅ |
| 2 | Auth JWT (cookie), roles, usuarios/clientes/productos con auditoría | ✅ |
| 3 | Máquina de estados, `transition()` con bloqueo de fila, historial + tests | ✅ |
| 4 | CRUD de licitaciones, productos con regla de presupuesto + tests | ✅ |
| 5 | Documento (signed URL) y envío real con adjunto + `EmailLog` + idempotencia | ✅ |
| 6 | Facturación y pagos transaccionales (auto-`cobrada`) | ⏳ pendiente |
| 7 | Jobs de vencimiento y recordatorio, cron en producción | ⏳ pendiente |
| 8 | Frontend: login, layout, formularios de clientes/productos/usuarios | ⏳ pendiente |
| 9 | Detalle de licitación, panel de próximas a vencer, `/api/docs` | ⏳ pendiente |
| 10 | Evidencias, E2E en producción, limpieza final | ⏳ pendiente |

---

## 2. Stack y por qué

| Pieza | Versión | Por qué |
|---|---|---|
| Next.js | 15.5 | Frontend (fases 8-9) y host de la API en un solo runtime; tipos compartidos cliente/servidor |
| Hono + `@hono/zod-openapi` | 4.13 / 1.6 | API ultraligera con middleware reutilizable y base para Swagger (`/api/docs`, pendiente) |
| Prisma | 6.19 | ORM tipado, migraciones versionadas y `Decimal` para dinero |
| Supabase (Postgres) | — | BD gestionada con pooler; migraciones vía `DIRECT_URL` |
| Supabase Storage | — | Subida de PDFs con signed URLs y URL pública verificable como evidencia |
| Resend | 6.32 | Correo real con adjunto, `Idempotency-Key` para reintentos sin duplicar |
| Vercel | — | Deploy continuo desde GitHub, variables de entorno y health check público |
| cron-job.org | — | ⏳ (fase 7) Jobs programados fuera del límite de Vercel Hobby |
| Vitest | 3.2 | Tests unitarios e de integración contra BD real |
| Zod | 4.6 | Validación de entrada en routes y `.env` |

## 3. Arquitectura

### Estructura de carpetas

```
app/                        # Next.js (App Router) — frontend pendiente fases 8-9
src/
  server/
    api/                    # Hono: routes/, middleware/ (auth, errores), guard.ts
    services/               # Toda la lógica de negocio; únicos que tocan Prisma
    domain/                 # Puro, sin I/O: state-machine.ts, errors.ts
    lib/                    # db, env, email, storage, pagination, html
  app/page.tsx              # Página actual (placeholder)
prisma/                     # schema.prisma, migrations/, seed.ts
tests/                      # Vitest (7 archivos, 60 tests)
scripts/                    # db-report, send-evidence, check-transitions
docs/                       # Evidencias (ver §12)
.env.example
```

**Regla de capas:** `routes` solo parsean/validan y llaman a `services`. `services` contienen la lógica y son los únicos que tocan Prisma. `domain` es puro (sin I/O).

### Diagrama de componentes

```mermaid
flowchart LR
    C[Cliente: navegador / curl] --> V[Vercel: Next.js + Hono]
    V --> DB[(Supabase Postgres)]
    V --> S[(Supabase Storage)]
    V --> R[Resend: correo con adjunto]
    J[cron-job.org ⏳] -->|POST /api/cron/tick| V
```

### Convenciones

- **Errores** — siempre `{ "error": { "code", "message", "details?" } }` con el HTTP correspondiente:

| Código | HTTP | Uso |
|---|---|---|
| `VALIDATION` | 400 | Datos inválidos (Zod, presupuesto, fechas, PDF) |
| `UNAUTHORIZED` | 401 | Sin sesión o credenciales inválidas |
| `FORBIDDEN` | 403 | Rol insuficiente (solo admin) |
| `NOT_FOUND` | 404 | Recurso inexistente |
| `INVALID_TRANSITION` / `NOT_EDITABLE` / `INVALID_STATE` / `CONFLICT` | 409 | Estado/versión en conflicto |
| `BUDGET_EXCEEDED` / `MISSING_PROPOSAL` / `DEADLINE_PASSED` / `PAYMENT_EXCEEDS_BALANCE` | 422 | Reglas de negocio |
| `EMAIL_FAILED` | 502 | Resend no pudo enviar |
| `INTERNAL` | 500 | Error no previsto |

- **Auditoría:** `createdById` / `updatedById` en todas las tablas operativas desde la fase 2.
- **Formato de respuestas:** objetos planos JSON (creación → `201`); listados → `{ data: [...], total, page, pageSize, totalPages }`; `DELETE` → `{ ok: true }`.
- **CSRF básico:** toda mutación exige `Content-Type: application/json` (si no → `400`).
- **Auth:** cookie `session` (httpOnly, sameSite=lax, 8 h) o `Authorization: Bearer <jwt>` para probar en Swagger. Públicas: `/api/health`, `/api/spike`, `/api/auth/login`.

## 4. Instalación y ejecución local

### Requisitos

- Node 20+ (probado con Node 24)
- Cuenta [Supabase](https://supabase.com) (proyecto con Postgres + Storage)
- Cuenta [Resend](https://resend.com) (API key)
- Nota: no hay `docker-compose.yml` en el repo; los tests y el desarrollo usan la BD de desarrollo de Supabase (§13)

### Pasos

```bash
cp .env.example .env        # y completar (tabla abajo)
npm install                 # ejecuta prisma generate (postinstall)
npx prisma migrate dev      # crea el schema
npx prisma db seed          # admin + usuario demo
npm run dev                 # http://localhost:3000
npm test                    # 60 tests
```

Comandos útiles: `npm run typecheck` · `npm run lint` · `npm run build`.

### Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Postgres vía **pooler transaccional (6543)** para la app (`pgbouncer=true`) |
| `DIRECT_URL` | Mismas credenciales para Prisma CLI (migraciones) |
| `JWT_SECRET` | Secreto de 32+ caracteres para firmar el JWT (HS256) |
| `JWT_EXPIRES_IN` | Duración de la sesión (default `8h`) |
| `SEED_ADMIN_*` / `SEED_USER_*` | Credenciales del seed (admin y demo `user`) |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave server-side **nunca** expuesta al cliente |
| `SUPABASE_BUCKET` | Bucket de Storage (`proposals`) |
| `RESEND_API_KEY` | API key de Resend |
| `EMAIL_FROM` | Remitente (`onboarding@resend.dev` sin dominio verificado) |
| `CRON_SECRET` / `REMINDER_HOURS` | ⏳ (fase 7) secreto del endpoint cron y horas de recordatorio |
| `APP_URL` | URL base (local o producción) |

### Supabase

1. Crear proyecto → copiar URL y `service_role` key.
2. **Storage → crear bucket `proposals` (público):** la URL del documento debe ser accesible como evidencia (ver §10).
3. Credenciales de conexión: usar el **pooler transaccional `:6543`** en `DATABASE_URL` y `DIRECT_URL` (algunos firewalls bloquean 5432).

### Resend

1. Crear API key → `RESEND_API_KEY`.
2. Sin dominio verificado solo se envía desde `onboarding@resend.dev` **al correo del titular de la cuenta** y llega a **Spam**. Para producción: verificar dominio y cambiar `EMAIL_FROM` (§13).

### Despliegue (Vercel)

1. Importar el repo → Vercel detecta Next.js (build: `npm run build`).
2. Configurar las mismas variables de entorno en el proyecto de Vercel.
3. Verificar `GET /api/health` → `{"status":"ok","db":"up"}`.

## 5. Modelo de datos

```mermaid
erDiagram
    User ||--o{ Tender : crea
    Client ||--o{ Tender : tiene
    Tender ||--|{ TenderProduct : contiene
    Product ||--o{ TenderProduct : referencia
    Tender ||--o{ Payment : recibe
    Tender ||--o{ TenderTransition : historial
    Tender ||--o{ EmailLog : correos
```

| Entidad | Papel | Campos clave |
|---|---|---|
| `User` | Usuarios del sistema | `role` (admin/user), `active`, `passwordHash` (bcrypt) |
| `Client` | Clientes de las licitaciones | `email` (índice, no unique), `taxId`, `contactName` |
| `Product` | Catálogo reutilizable | `sku` unique, `basePrice NUMERIC(12,2)` |
| `Tender` | Licitación (entidad central) | `status`, `maxBudget`, `deadline` (UTC), `proposalPath/Url/Name/Size`, `sentAt`, `reminderSentAt`, `invoicedAmount/At` |
| `TenderProduct` | Línea de producto en la licitación | `quantity`, **`unitPrice` (copia del `basePrice` al agregar)**, unique `(tenderId, productId)` |
| `Payment` | Pagos (fase 6) | `amount > 0` (CHECK), `paidAt` |
| `TenderTransition` | Historial de estados | `fromStatus` (null en creación), `toStatus`, `userId` (null = sistema), `reason` |
| `EmailLog` | Trazabilidad de correos | `type` (envio/recordatorio), `status` (enviado/fallido), `providerId` de Resend, `error` |

Decisiones de modelado: `borrador` es estado explícito en BD (aunque el enunciado lo llame implícito); dinero siempre en `NUMERIC(12,2)` + `Decimal` de Prisma (nunca `float`); fechas en UTC (`timestamptz`).

## 6. Máquina de estados

```mermaid
stateDiagram-v2
    [*] --> borrador: creación (reason: creacion)
    borrador --> activa: envío del documento (reason: envio)
    activa --> finalizada: finalize (manual)
    activa --> perdida: lose (manual)
    activa --> perdida: vencimiento de deadline ⏳ fase 7
    finalizada --> por_cobrar: facturación ⏳ fase 6
    por_cobrar --> cobrada: saldo 0 ⏳ fase 6
    cobrada --> [*]
    perdida --> [*]
```

| Desde | Hasta | Quién / qué la dispara |
|---|---|---|
| *(null)* | `borrador` | `POST /api/tenders` (creación, `reason: creacion`) |
| `borrador` | `activa` | `POST /api/tenders/:id/send` (`reason: envio`) |
| `activa` | `finalizada` | `POST /api/tenders/:id/finalize` (`reason: manual`) |
| `activa` | `perdida` | `POST /api/tenders/:id/lose` (`reason: manual`) / cron ⏳ (`vencimiento_automatico`) |
| `finalizada` | `por_cobrar` | ⏳ fase 6 (`facturada`) |
| `por_cobrar` | `cobrada` | ⏳ fase 6 (`saldo_cero`) |

Cualquier otra combinación → `409 INVALID_TRANSITION`.

### `transition()` (`src/server/services/tender.service.ts`)

1. `SELECT status FROM tenders WHERE id = $1 FOR UPDATE` — bloquea la fila dentro de la transacción.
2. Revalida con `canTransition(from, to)` **sobre el estado leído bajo bloqueo** (no el que el cliente creyó ver).
3. Actualiza `status` + `updatedById` y crea el registro en `TenderTransition` con `fromStatus`, `toStatus`, `userId` y `reason` — en la misma transacción.

Todo lo que cambia de estado pasa por aquí: es la única puerta y el historial nunca se desincroniza del estado.

### Edición por estado

- **Productos** editables solo en `borrador` y `activa` (`PRODUCT_EDITABLE`) → si no, `409 NOT_EDITABLE`.
- **Documento** modificable solo en `borrador` → si no, `409 NOT_EDITABLE` (tras el envío es inmutable, ver §10).

## 7. Reglas de negocio implementadas

| Regla | Dónde se aplica | Error |
|---|---|---|
| Σ (cantidad × precio) ≤ `maxBudget`, con `Decimal` (límite exacto OK, +1 centavo no) | `addProduct` / upsert en `tender-products.service.ts` | `422 BUDGET_EXCEEDED` |
| Productos solo editables en `borrador`/`activa` | `tender-products.service.ts` | `409 NOT_EDITABLE` |
| Documento solo modificable en `borrador` | `proposal.service.ts` (`requireBorrador`) | `409 NOT_EDITABLE` |
| `deadline` futura y `maxBudget > 0` al crear | `createTender` | `400 VALIDATION` |
| Envío solo desde `borrador` | `sendTender` | `409 INVALID_STATE` |
| Envío requiere documento | `sendTender` | `422 MISSING_PROPOSAL` |
| Envío requiere `deadline` vigente | `sendTender` | `422 DEADLINE_PASSED` |
| Envío requiere ≥ 1 producto | `sendTender` | `400 VALIDATION` |
| Transiciones solo según la tabla de la §6 | `transition()` | `409 INVALID_TRANSITION` |
| PDF ≤ 10 MB y `application/pdf` (validado en la petición **y** con los metadatos reales de Storage al confirmar) | `proposal.service.ts` | `400 VALIDATION` |
| El `path` confirmado pertenece a la licitación (`tenders/{id}/...`) | `confirmUpload` | `400 VALIDATION` |

## 8. Flujo de envío (fase 5)

`POST /api/tenders/:id/send` ejecuta 4 pasos **en este orden**:

```mermaid
sequenceDiagram
    participant C as Cliente
    participant API as Hono (Vercel)
    participant DB as Postgres
    participant ST as Storage
    participant RS as Resend
    C->>API: POST /api/tenders/:id/send
    API->>DB: 1. Validar (borrador, documento, deadline, ≥1 producto)
    API->>ST: 2. Descargar el PDF
    API->>RS: 3. Correo con adjunto (Idempotency-Key: tender-{id}-envio)
    RS-->>API: messageId
    API->>DB: 4. TX: FOR UPDATE → activa + sentAt + EmailLog(enviado)
    API-->>C: 200 { status: "activa" }
    Note over API,RS: Si Resend falla → EmailLog(fallido) + 502 y sin transición
```

1. **Validar** (estado, documento, deadline, productos) — antes de tocar Storage o Resend; cualquier fallo devuelve su error y no hay efectos secundarios.
2. **Descargar el PDF** de Storage — si Storage está caído, falla aquí y tampoco se envía correo.
3. **Enviar el correo** con adjunto vía Resend, con `idempotencyKey: tender-{id}-envio`.
4. **Transicionar en transacción:** `transition()` re-verifica el estado bajo `FOR UPDATE` y guarda `sentAt` + `EmailLog(enviado, providerId)` junto con el cambio de estado.

**Si el correo falla (paso 3):** se crea `EmailLog(fallido)` con el mensaje, la API responde `502 EMAIL_FAILED` y la licitación **sigue en `borrador`** — es decir, nunca queda "activa sin notificar".

**Idempotencia y fallo parcial:** si el correo salió pero la transacción del paso 4 falla (BD caída), el reintento usa la misma `Idempotency-Key` y Resend no crea un segundo correo. Riesgo residual: en ese caso el `EmailLog(enviado)` se pierde hasta el reintento (§13).

**Doble envío concurrente:** dos peticiones simultáneas pasan la validación, pero en el paso 4 solo una obtiene el `FOR UPDATE`; la otra relee `activa` y recibe `409 INVALID_TRANSITION`. Cubierto por test (`send.test.ts`).

## 9. API

| Método | Ruta | Rol | Descripción | Errores |
|---|---|---|---|---|
| POST | `/api/auth/login` | público | Login → cookie `session` | 401 |
| POST | `/api/auth/logout` | auth | Borra la cookie | 401 |
| GET | `/api/auth/me` | auth | Usuario actual | 401 |
| GET | `/api/users` | admin | Lista usuarios (paginación) | 401/403 |
| POST | `/api/users` | admin | Crea usuario | 400/401/403/409 |
| GET | `/api/clients` | auth | Lista clientes (`?q=&page=`) | 401 |
| POST | `/api/clients` | auth | Crea cliente | 400/401 |
| GET | `/api/products` | auth | Lista productos (`?q=&page=`) | 401 |
| POST | `/api/products` | auth | Crea producto | 400/401/409 (SKU) |
| GET | `/api/tenders` | auth | Lista (`?status=&clientId=&q=&page=&pageSize=`) | 400/401 |
| GET | `/api/tenders/expiring?days=` | auth | Activas a vencer (default 3 días, máx 50) | 400/401 |
| POST | `/api/tenders` | auth | Crea en `borrador` + historial | 400/401/404 |
| GET | `/api/tenders/:id` | auth | Detalle (productos, pagos, saldo, historial, correos) | 401/404 |
| GET | `/api/tenders/:id/transitions` | auth | Historial completo | 401/404 |
| POST | `/api/tenders/:id/products` | auth | Agrega producto (upsert de cantidad) | 400/401/404/409/422 |
| DELETE | `/api/tenders/:id/products/:productId` | auth | Quita producto | 401/404/409 |
| POST | `/api/tenders/:id/proposal/upload-url` | auth | Signed URL para subir PDF | 400/401/404/409 |
| POST | `/api/tenders/:id/proposal/confirm` | auth | Confirma documento (valida Storage) | 400/401/404/409 |
| POST | `/api/tenders/:id/send` | auth | Envío real + `activa` | 401/404/409/422/502 |
| POST | `/api/tenders/:id/finalize` | auth | `activa → finalizada` | 401/404/409 |
| POST | `/api/tenders/:id/lose` | auth | `activa → perdida` | 401/404/409 |
| GET | `/api/health` | público | `{ status, time, db }` | — |
| GET | `/api/spike` | público | Prueba temporal de integraciones (fase 1) | — |

### Ejemplo del flujo completo (curl)

```bash
BASE=https://sistema-de-gesti-n-de-licitaciones.vercel.app
# o BASE=http://localhost:3000

# 0) Login (guarda la cookie)
echo '{"email":"admin@example.com","password":"CambiaEstaClave123!"}' > login.json
curl -s -c cookies.txt -H "Content-Type: application/json" -d @login.json $BASE/api/auth/login

# 1) Cliente y producto
echo '{"name":"ACME","email":"compras@acme.test"}' > client.json
CLIENT_ID=$(curl -s -b cookies.txt -H "Content-Type: application/json" -d @client.json $BASE/api/clients | node -p "JSON.parse(require('fs').readFileSync(0)).id")

echo '{"name":"Servicio consultoría","sku":"CONS-01","basePrice":3000}' > product.json
PRODUCT_ID=$(curl -s -b cookies.txt -H "Content-Type: application/json" -d @product.json $BASE/api/products | node -p "JSON.parse(require('fs').readFileSync(0)).id")

# 2) Crear licitación (presupuesto 5000)
echo "{\"clientId\":\"$CLIENT_ID\",\"title\":\"Licitación demo\",\"maxBudget\":5000,\"deadline\":\"2027-01-01T00:00:00Z\"}" > tender.json
TENDER_ID=$(curl -s -b cookies.txt -H "Content-Type: application/json" -d @tender.json $BASE/api/tenders | node -p "JSON.parse(require('fs').readFileSync(0)).id")

# 3) Agregar producto: 2 × 3000 = 6000 > 5000 → 422 BUDGET_EXCEEDED
echo "{\"productId\":\"$PRODUCT_ID\",\"quantity\":2}" > add.json
curl -s -b cookies.txt -H "Content-Type: application/json" -d @add.json $BASE/api/tenders/$TENDER_ID/products
# {"error":{"code":"BUDGET_EXCEEDED","message":"...excede el presupuesto..."}}

# 4) Corregir: quitar y volver a agregar 1 unidad (3000 ≤ 5000 → 201)
curl -s -b cookies.txt -X DELETE $BASE/api/tenders/$TENDER_ID/products/$PRODUCT_ID
echo "{\"productId\":\"$PRODUCT_ID\",\"quantity\":1}" > add.json
curl -s -b cookies.txt -H "Content-Type: application/json" -d @add.json $BASE/api/tenders/$TENDER_ID/products

# 5) Subir el PDF (signed URL + PUT directo a Storage)
echo '{"fileName":"propuesta.pdf","size":1024,"contentType":"application/pdf"}' > up.json
UP=$(curl -s -b cookies.txt -H "Content-Type: application/json" -d @up.json $BASE/api/tenders/$TENDER_ID/proposal/upload-url)
PATH_FILE=$(echo $UP | node -p "JSON.parse(require('fs').readFileSync(0)).path")
TOKEN=$(echo $UP | node -p "JSON.parse(require('fs').readFileSync(0)).token")
SUPABASE_URL=https://xxxx.supabase.co   # tu proyecto
BUCKET=proposals
echo '%PDF-1.4 ...' > propuesta.pdf     # o tu PDF real
curl -s -X PUT -H "Content-Type: application/pdf" --data-binary @propuesta.pdf \
  "$SUPABASE_URL/storage/v1/object/$BUCKET/$PATH_FILE?token=$TOKEN"

# 6) Confirmar y enviar (correo real con adjunto → activa)
echo "{\"path\":\"$PATH_FILE\"}" > confirm.json
curl -s -b cookies.txt -H "Content-Type: application/json" -d @confirm.json $BASE/api/tenders/$TENDER_ID/proposal/confirm
curl -s -b cookies.txt -X POST -H "Content-Type: application/json" $BASE/api/tenders/$TENDER_ID/send
# {"status":"activa","sentAt":"..."}
```

## 10. Decisiones de diseño

| Decisión | Motivo | Alternativa descartada |
|---|---|---|
| Documento **inmutable tras el envío** (solo editable en `borrador`) | Trazabilidad: el PDF guardado es exactamente lo que recibió el cliente; un cambio posterior rompería la evidencia | Editar también en `activa` (el enunciado lo permite, pero debilita la prueba de qué se envió) |
| **Signed URL** en vez de subir el archivo por la función de la API | El binario no pasa por Vercel (límite ~4.5 MB) y el cliente sube directo a Storage con token de un solo uso | `POST multipart` con límite 4 MB (variante del plan; válida pero centraliza tráfico inútil) |
| **Copiar `unitPrice`** al agregar el producto | Si `basePrice` cambia después, las licitaciones existentes no se alteran (histórico estable) | Recalcular siempre desde `products.basePrice` (reescribe la historia) |
| **Correo antes de transicionar** + `Idempotency-Key` | Nunca queda "activa sin notificar"; el reintento tras fallo parcial no duplica el correo | Transicionar primero y avisar después (estado mentiría si el correo falla) |
| **`finalize`/`lose` como wrappers** de `changeState()` → `transition()` | Una sola puerta para el cambio de estado y el historial; los endpoints son alias semánticos | Lógica de estado propia en cada endpoint (reglas duplicadas) |
| **Sanitizar el nombre de archivo** y validar que el `path` empieza con `tenders/{id}/` | Evita path traversal y que un cliente confirme archivos ajenos | Confiar en el `path` que envía el cliente |
| **BD antes que Storage** al reemplazar documento: se guarda la referencia nueva y recién ahí se borra la anterior | Una referencia rota es peor que un archivo huérfano en Storage | Borrar primero (ventana con `proposalUrl` colgando) |
| Bucket `proposals` **público** | La URL del documento debe ser accesible y verificable como evidencia de entrega | Bucket privado + `createSignedUrl` temporal (más seguro, pero la URL no sirve como evidencia persistente) |
| ⏳ **Cron externo (cron-job.org)** en vez de Vercel Cron | *(fase 7)* Sin límites del plan Hobby y ticks más frecuentes que el mínimo de Vercel | `vercel.json` + Vercel Cron (mínimo 1/día en Hobby, no sirve para recordatorios) |

## 11. Pruebas

```bash
npm test        # vitest run — 7 archivos, 60 tests
```

Corren contra la **BD de desarrollo** con usuarios de test (`test-admin@example.com` / `test-user@example.com`); `fileParallelism: false` para evitar carreras sobre las mismas filas.

| Archivo | Qué cubre |
|---|---|
| `auth.test.ts` | Login/logout/`me`, cookie, 403 por rol, CSRF (mutación sin JSON → 400) |
| `state-machine.test.ts` | Tabla completa de transiciones: 36 combinaciones permitidas/prohibidas + `PRODUCT_EDITABLE` |
| `transition.test.ts` | `FOR UPDATE`, 404, 409 con detalle `{from,to}`, registro en historial |
| `budget.test.ts` | Límite exacto aceptado, +1 centavo → 422, upsert descuenta el subtotal anterior |
| `tenders.test.ts` | HTTP: crear/listar con filtros, `finalize`/`lose`, `expiring`, detalle con totales |
| `proposal.test.ts` | **Storage real**: validación PDF/10 MB, flujo upload→confirm, path ajeno → 400, revalidación de estado, borrado del archivo anterior |
| `send.test.ts` | **Resend mockeado**: missing proposal, deadline, sin productos, estado inválido, OK → `activa` + `EmailLog` + idempotency key, `EMAIL_FAILED` 502 sin transición, doble envío concurrente (1 gana, 1 → 409) |

**No se automatiza:** el correo real (se verifica a mano con la evidencia de §12) y el comportamiento de cron-job.org (fase 7).

## 12. Evidencias

Índice en [`docs/`](docs/README.md).

| Evidencia | Estado |
|---|---|
| Correo recibido con adjunto (inbox/Spam) | ⏳ captura pendiente → `docs/evidencia-correo.png` |
| `EmailLog` del envío real (providerId `01a116ae-eb87-786f-bdb9-e442a34f0cba`) | ✅ texto en `docs/emaillog-envio-fase5.json` |
| Documento accesible por URL real (HTTP 200, `application/pdf`) | ✅ URL en `docs/emaillog-envio-fase5.json` |
| Log del cron en producción | ⏳ fase 7 → `docs/evidencia-cron.png` |
| Prueba E2E en producción (checklist del enunciado) | ⏳ fase 10 |

## 13. Limitaciones conocidas y pendientes

**Pendientes por fase (ver tabla de §1):**

- **Fase 6:** facturación (`finalizada → por_cobrar`) y pagos con transacción + bloqueo de fila, auto-`cobrada`, tests de concurrencia.
- **Fase 7:** jobs de vencimiento y recordatorio, `POST /api/cron/tick`, configuración de cron-job.org y su evidencia.
- **Fases 8-9:** frontend completo, panel de próximas a vencer, `/api/docs` (Swagger).
- **Fase 10:** E2E en producción, limpieza y credenciales.

**Limitaciones asumidas hoy:**

- **Endpoints de modificación/borrado** de usuarios, clientes y productos: solo existen listado y creación (`GET`/`POST`).
- **Fallo parcial del envío** (correo OK + BD caída): mitigado con `Idempotency-Key`, pero no hay cola de reintentos; el `EmailLog` se completa en el siguiente intento.
- **Resend sin dominio verificado:** remitente `onboarding@resend.dev`, entrega solo al titular y a Spam. Pendiente verificar dominio (§4).
- **Sin rate limit** ni bloqueo por intentos fallidos de login.
- **`/api/docs`** aún no existe (la app usa `OpenAPIHono`, el endpoint queda para la fase 9).
- **Tests contra BD de desarrollo** en lugar de Postgres local con Docker (no disponible en la máquina).
- **`prisma migrate deploy`** puede colgarse tras aplicar el SQL en este entorno (workaround: verificar con `scripts/db-report.js`); causa no resuelta.

---

### Guías rápidas

- **Subir un documento:** `POST /:id/proposal/upload-url` → `PUT` a Storage con `token` → `POST /:id/proposal/confirm`.
- **Enviar:** `POST /:id/send` (solo desde `borrador` con documento y deadline vigente).
- **Historial:** `GET /:id/transitions` y `GET /:id` (incluye `transitions` y `emails`).
- **Evidencia reproducible:** `node --env-file=.env --import tsx scripts/send-evidence.ts`.
