# Evidencias

Archivos de evidencia del proyecto. Guardar cada uno en cuanto se genere (no esperar a la fase 10).

| Archivo | Descripción | Estado |
|---|---|---|
| `evidencia-correo.png` | Captura del correo de envío (fase 5) con el PDF adjunto (inbox o Spam) | ✅ |
| `evidencia-cron-correo.png` | Captura de los correos de recordatorio del cron (fase 7, inbox o Spam) | ✅ |
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
