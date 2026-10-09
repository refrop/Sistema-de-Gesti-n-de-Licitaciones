# Evidencias

Archivos de evidencia del proyecto. Guardar cada uno en cuanto se genere (no esperar a la fase 10).

| Archivo | Descripción | Estado |
|---|---|---|
| `evidencia-correo.png` | Cuerpo del correo de envío (fase 5) renderizado desde la plantilla actual (`mail-templates.ts`); el PDF se adjunta al enviar | ✅ |
| `evidencia-cron-correo.png` | Cuerpo del correo de recordatorio del cron (fase 7) renderizado desde la plantilla actual | ✅ |
| `evidencia-cron-recordatorio.png` | Sonda fase 10: detalle de la licitación con `EmailLog recordatorio → enviado` (disparado por el cron, 05:43:57 UTC); UI cósmica actual, correo del cliente difuminado | ✅ |
| `evidencia-cron-vencimiento.png` | Sonda fase 10: detalle de la licitación que pasó sola a `perdida` (`userId` nulo, `vencimiento_automatico`, 05:43:57 UTC); UI cósmica actual, correo del cliente difuminado | ✅ |
| `evidencia-cron-actions.png` | Workflow "Tick de licitaciones" en la pestaña Actions: 1 run manual + 5 runs `Scheduled`, todos `success` | ✅ |
| `evidencia-e2e.png` | Prueba E2E en producción: login, panel de vencer y listado con filtros/badges (UI cósmica actual) | ✅ |
| `login.png` | Pantalla de login (nebulosa cosmic) — cabecera del README raíz | ✅ |

## Cómo generar la evidencia del envío

1. Ejecutar `node --env-file=.env --import tsx scripts/send-evidence.ts` (crea una licitación, sube el PDF, envía el correo real).
2. Buscar el correo en el inbox/Spam del destinatario y capturar la imagen → `evidencia-correo.png`.
3. El resto de datos (providerId, URL pública del documento) quedan en §12 del README raíz.

## Cómo generar la evidencia del cron

1. Ejecutar `node --env-file=.env --import tsx scripts/cron-evidence.ts` (crea la licitación A con deadline +3 min y la B con +47 h).
2. Llamar al tick en producción: `curl -H "Authorization: Bearer $CRON_SECRET" https://sistema-de-gesti-n-de-licitaciones.vercel.app/api/cron/tick`.
3. Tras ~3 min, repetir el llamado: A aparece como `perdida` (reason `vencimiento_automatico`) y B no recibe segundo recordatorio.
4. Capturar los correos de recordatorio recibidos → `evidencia-cron-correo.png`.

## Cómo se generó la evidencia del cron automático (fase 10)

Qué quedó probado en producción (2026-10-08):

1. **Repository secret de GitHub:** `CRON_SECRET` con el mismo valor que `.env`/Vercel,
   creado por API (`PUT /repos/.../actions/secrets/CRON_SECRET`). Sin él, el job
   falla con 401 y Actions lo marca en rojo.
2. **Vercel Cron — disparador automático verificado:** `vercel.json` → `0 5 * * *`
   (1 al día, límite del plan Hobby; la precisión es ±59 min, puede disparar
   entre 05:00 y 05:59 UTC). El 08/10 a las **05:43:57 UTC** Vercel llamó
   `/api/cron/tick` sin intervención de nadie y resolvió las dos sondas creadas
   a las 04:40 en un solo tick: recordatorio enviado (`reminderSentAt` +
   EmailLog `recordatorio → enviado`) y `activa → perdida` con
   `userId: null` / `vencimiento_automatico`.
3. **GitHub Actions — workflow válido pero `schedule` sin disparar:**
   `.github/workflows/cron.yml` (`*/15 * * * *` + `workflow_dispatch`) está en
   `main`, el workflow está en `state: active`, Actions está habilitado y el
   job **manual** corre (run #1, 02:09 UTC, `success`). El evento `schedule` no
   se ha ejecutado en 12+ ranuras consecutivas (02:15–06:00 UTC) pese a un
   re-push del archivo: limitación documentada en §13 del README raíz. El botón
   **Actions → Run workflow** sí sirve para forzar un tick a mano.

Pasos para reproducir la evidencia:

1. Crear dos sondas `activa` (una con deadline +47 h y otra con +5 min) y
   **no** llamar a `/api/cron/tick`.
2. Esperar la ventana de Vercel Cron (05:00–05:59 UTC). **Ojo:** no ejecutar
   `npm test` mientras esperas — los tests llaman `runTick()` contra esta misma
   BD y resolverían las sondas antes que el cron (pasó y hay que rehacerlas).
3. Verificar en BD: `reminderSentAt` + EmailLog del recordatorio en la R;
   transición `activa → perdida` con `userId: null` y
   `reason: vencimiento_automatico` en la V.
4. Capturas: detalle de cada licitación (`evidencia-cron-recordatorio.png`,
   `evidencia-cron-vencimiento.png`) e historial de Actions
   (`evidencia-cron-actions.png`).

## Auditoría de secretos en el historial de Git (fase 10)

| Comprobación | Resultado |
|---|---|
| Archivos añadidos en los 47 commits del historial (`git log --all --diff-filter=A --name-only`) | Único archivo de entorno: `.env.example` con placeholders; `.env*` está en `.gitignore` (excepto `.env.example`) |
| Búsqueda de JWTs (`eyJhbGciOi…`) y claves tipo `re_…` en todo el historial | 0 coincidencias reales (el único texto que matchea es esta propia tabla, que contiene los patrones de búsqueda) |
| URLs del remoto (`git remote -v`) | Sin tokens ni credenciales |
| `.env` local | Gitignored, nunca versionado |

Conclusión: **no hay secretos en el historial de Git**. Aun así, después de la
evaluación se rotan las credenciales demo (admin/user) y las API keys de correo
(`RESEND_API_KEY` / `BREVO_API_KEY`, ver §13 del README raíz).

## Cómo se hicieron los smokes de Playwright (fase 9-10)

Los smokes no están versionados a propósito (son artefactos de desarrollo, no
parte del entregable). Se ejecutaron así:

1. `npm run build && npx next start -p 3112` (probado también contra producción
   con la misma secuencia apuntando a la URL de Vercel).
2. Chromium con `--enable-unsafe-swiftshader --use-angle=swiftshader` (entorno
   headless sin GPU) y esperas `domcontentloaded` — nunca `networkidle`, porque
   la UI consulta la API de forma continua.
3. Login con `page.getByLabel("Correo")` / `getByLabel("Contraseña")` y
   `waitForURL(/\/tenders/)`; datos de setup creados por API con la cookie de
   sesión (los Select de Radix se manipulan con clic en el trigger +
   `[role="option"]`).
4. Watchdog de ~7 min y `taskkill /T /F` del proceso en el `finally` (si no, el
   pipe queda abierto y se pierde la salida).
5. Cada smoke terminaba con `git status --porcelain` limpio: los temporales se
   borraban al cerrar (PDF y scripts `tmp-*`).
