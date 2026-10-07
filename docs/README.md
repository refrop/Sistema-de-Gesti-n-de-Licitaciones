# Evidencias

Archivos de evidencia del proyecto. Guardar cada uno en cuanto se genere (no esperar a la fase 10).

| Archivo | Descripción | Estado |
|---|---|---|
| `emaillog-envio-fase5.json` | Registro del envío real (fase 5): `EmailLog` con `providerId` de Resend, historial de transiciones y URL pública del PDF (HTTP 200) | ✅ |
| `evidencia-cron.json` | Ticks reales en producción (fase 7): recordatorios con `providerId` y vencimiento automático (`userId: null`, `reason: vencimiento_automatico`) | ✅ |
| `evidencia-correo.png` | Captura del correo de envío con el PDF adjunto (inbox o Spam) | ⏳ pendiente |
| `evidencia-cron-correo.png` | Captura del correo de recordatorio recibido (inbox o Spam) | ⏳ pendiente |
| `evidencia-e2e.png` | Prueba E2E completa en producción | ⏳ fase 10 |

## Cómo generar la evidencia del envío

1. Ejecutar `node --env-file=.env --import tsx scripts/send-evidence.ts` (crea una licitación, sube el PDF, envía el correo real).
2. Buscar el correo en el inbox/Spam del destinatario y capturar la imagen → `evidencia-correo.png`.
3. El resto de datos (providerId, URL del documento) quedan en `emaillog-envio-fase5.json`.

## Cómo generar la evidencia del cron

1. Ejecutar `node --env-file=.env --import tsx scripts/cron-evidence.ts` (crea la licitación A con deadline +3 min y la B con +47 h).
2. Llamar al tick en producción: `curl -H "Authorization: Bearer $CRON_SECRET" https://sistema-de-gesti-n-de-licitaciones.vercel.app/api/cron/tick`.
3. Tras ~3 min, repetir el llamado: A aparece como `perdida` (reason `vencimiento_automatico`) y B no recibe segundo recordatorio.
4. Capturar el correo de recordatorio → `evidencia-cron-correo.png`; los datos quedan en `evidencia-cron.json`.
