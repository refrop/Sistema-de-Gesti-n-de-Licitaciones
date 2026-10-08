# Evidencias

Archivos de evidencia del proyecto. Guardar cada uno en cuanto se genere (no esperar a la fase 10).

| Archivo | Descripción | Estado |
|---|---|---|
| `evidencia-correo.png` | Captura del correo de envío (fase 5) con el PDF adjunto (inbox o Spam) | ✅ |
| `evidencia-cron-correo.png` | Captura de los correos de recordatorio del cron (fase 7, inbox o Spam) | ✅ |
| `evidencia-cron-recordatorio.png` | Sonda fase 10: recordatorio disparado **solo**, sin llamar a `/api/cron/tick` | ⏳ fase 10 |
| `evidencia-cron-vencimiento.png` | Sonda fase 10: licitación que pasa sola a `perdida` (`userId` nulo, `vencimiento_automatico`) | ⏳ fase 10 |
| `evidencia-cron-actions.png` | Historial de ejecuciones del workflow de GitHub Actions (tick cada 15 min) | ⏳ fase 10 |
| `evidencia-e2e.png` | Prueba E2E completa en producción | ⏳ fase 10 |

## Cómo generar la evidencia del envío

1. Ejecutar `node --env-file=.env --import tsx scripts/send-evidence.ts` (crea una licitación, sube el PDF, envía el correo real).
2. Buscar el correo en el inbox/Spam del destinatario y capturar la imagen → `evidencia-correo.png`.
3. El resto de datos (providerId, URL pública del documento) quedan en §12 del README raíz.

## Cómo generar la evidencia del cron

1. Ejecutar `node --env-file=.env --import tsx scripts/cron-evidence.ts` (crea la licitación A con deadline +3 min y la B con +47 h).
2. Llamar al tick en producción: `curl -H "Authorization: Bearer $CRON_SECRET" https://sistema-de-gesti-n-de-licitaciones.vercel.app/api/cron/tick`.
3. Tras ~3 min, repetir el llamado: A aparece como `perdida` (reason `vencimiento_automatico`) y B no recibe segundo recordatorio.
4. Capturar los correos de recordatorio recibidos → `evidencia-cron-correo.png`.

## Cómo generar la evidencia del cron automático (fase 10)

El tick ya **no se dispara a mano**: `.github/workflows/cron.yml` lo ejecuta cada
15 minutos (`*/15 * * * *`) contra producción con
`curl -fsS -H "Authorization: Bearer $CRON_SECRET"` y también a demanda desde la
pestaña **Actions → Run workflow** (`workflow_dispatch`).

1. Repository secret de GitHub: `CRON_SECRET` (mismo valor que en `.env`/Vercel).
   Sin él, el job falla con 401 y Actions lo marca en rojo.
2. Sonda sin intervención: crear dos licitaciones `activa` (una con `deadline`
   +47 h y otra con +3 min) y **no** llamar a `/api/cron/tick`.
3. Esperar hasta 30 min: la primera debe recibir recordatorio y la segunda debe
   pasar sola a `perdida` (`reason: vencimiento_automatico`, `userId: null`).
4. Capturas: detalle de cada licitación (`evidencia-cron-recordatorio.png`,
   `evidencia-cron-vencimiento.png`) e historial de Actions
   (`evidencia-cron-actions.png`).

## Auditoría de secretos en el historial de Git (fase 10)

| Comprobación | Resultado |
|---|---|
| Archivos añadidos en los 40 commits del historial (`git log --all --diff-filter=A --name-only`) | Único archivo de entorno: `.env.example` con placeholders; `.env*` está en `.gitignore` (excepto `.env.example`) |
| Búsqueda de JWTs (`eyJhbGciOi…`) y claves tipo `re_…` en todo el historial | 0 coincidencias |
| URLs del remoto (`git remote -v`) | Sin tokens ni credenciales |
| `.env` local | Gitignored, nunca versionado |

Conclusión: **no hay secretos en el historial de Git**. Aun así, después de la
evaluación se rotan las credenciales demo (admin/user) y la `RESEND_API_KEY`
(ver §13 del README raíz).

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
