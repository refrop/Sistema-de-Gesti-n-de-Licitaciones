# Evidencias

Archivos de evidencia del proyecto. Guardar cada uno en cuanto se genere (no esperar a la fase 10).

| Archivo | Descripción | Estado |
|---|---|---|
| `emaillog-envio-fase5.json` | Registro del envío real (fase 5): `EmailLog` con `providerId` de Resend, historial de transiciones y URL pública del PDF (HTTP 200) | ✅ |
| `evidencia-correo.png` | Captura del correo recibido con el PDF adjunto (inbox o Spam) | ⏳ pendiente |
| `evidencia-cron.png` | Log de la ejecución del cron en producción (vencimiento + recordatorio) | ⏳ fase 7 |
| `evidencia-e2e.png` | Prueba E2E completa en producción | ⏳ fase 10 |

## Cómo generar la evidencia del envío

1. Ejecutar `node --env-file=.env --import tsx scripts/send-evidence.ts` (crea una licitación, sube el PDF, envía el correo real).
2. Buscar el correo en el inbox/Spam del destinatario y capturar la imagen → `evidencia-correo.png`.
3. El resto de datos (providerId, URL del documento) quedan en `emaillog-envio-fase5.json`.
