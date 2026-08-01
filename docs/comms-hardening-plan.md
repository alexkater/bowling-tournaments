# Communications Hardening Release

## Objetivo
Convertir la base actual de notificaciones/email en una capa operativa y recuperable sin introducir Redis ni depender de memoria del proceso.

## Alcance de este release
1. Corregir el listado de notificaciones y dejar de ocultar errores de persistencia.
2. Reemplazar el envío directo por un outbox PostgreSQL:
   - enqueue idempotente;
   - claim con locking;
   - estados `pending | processing | sent | failed`;
   - reintentos con backoff y límite;
   - registro del ID del proveedor y del último error;
   - jobs pendientes conservados si falta configuración del proveedor.
3. Ejecutar un worker liviano en el proceso API, protegido por locks de fila, lease temporal y apagado limpio.
4. Completar eventos de inscripción:
   - confirmado;
   - waitlist;
   - promoción;
   - cancelación del propio jugador.
5. Añadir anuncios del organizador a inscritos de su propio torneo:
   - aislamiento por organización y rol;
   - idempotencia por `clientMutationId`;
   - in-app siempre y email opcional;
   - límites de asunto/cuerpo.
6. Añadir UI mínima en la vista de participantes y E2E del aviso.

## Fuera de alcance de este release
- Activar Resend o verificar DNS (requiere una cuenta/API key del propietario).
- Recuperación de contraseña y verificación obligatoria de email; se harán en el siguiente release de autenticación para no mezclar cambios de acceso con el outbox.
- Telegram/WhatsApp.

## Activación del proveedor
La entrega real permanece desactivada hasta configurar simultáneamente:
- `RESEND_API_KEY` con una credencial válida;
- `EMAIL_FROM` con un remitente cuyo dominio esté verified en Resend.

Si falta cualquiera de las dos variables, el worker no reclama jobs ni consume intentos: el outbox permanece `pending`. Un estado `sent` significará aceptación del proveedor, no entrega al buzón; `delivered` requerirá webhooks en un release posterior.

## TDD
Cada comportamiento se implementará como un ciclo RED → GREEN:
- persistencia/actualización del email sin PK duplicada;
- idempotencia del outbox;
- retry/backoff;
- cancelación notifica al jugador;
- broadcast autorizado y aislamiento multi-tenant;
- campana muestra el aviso.

## Riesgos y mitigaciones
- **Duplicados:** índice único por `idempotencyKey`.
- **Dos workers:** `FOR UPDATE SKIP LOCKED` + lease/lock temporal.
- **Proveedor o remitente ausente:** jobs quedan `pending`, sin consumir intentos.
- **Fallo parcial de broadcast:** anuncio persistido; destinatarios idempotentes y reanudables.
- **Sobrecarga:** el worker reclama lotes acotados (máximo 100).

## Rollback
- Código: retag de imágenes por `deploy.sh`.
- DB: migración aditiva; las columnas/tablas nuevas no rompen el release anterior.
- Provider: worker se mantiene inactivo si falta `RESEND_API_KEY` o `EMAIL_FROM`.

## Gates
`pnpm install --frozen-lockfile`, typecheck, lint, tests, infra, build, diff-check, secret scan, revisión independiente, PR, CI verde, merge, backup/deploy y smoke de producción.
