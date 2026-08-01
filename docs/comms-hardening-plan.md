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
   - jobs pendientes conservados si falta `RESEND_API_KEY`.
3. Ejecutar un worker liviano en el proceso API, protegido por advisory lock y apagado limpio.
4. Completar eventos de inscripción:
   - confirmado;
   - waitlist;
   - promoción;
   - cancelación del propio jugador.
5. Añadir anuncios del organizador a inscritos de su propio torneo:
   - aislamiento por organización y rol;
   - idempotencia por `clientMutationId`;
   - in-app siempre y email opcional;
   - límites de asunto/cuerpo y tamaño de audiencia.
6. Añadir UI mínima en la vista de participantes y E2E del aviso.

## Fuera de alcance de este release
- Activar Resend o verificar DNS (requiere una cuenta/API key del propietario).
- Recuperación de contraseña y verificación obligatoria de email; se harán en el siguiente release de autenticación para no mezclar cambios de acceso con el outbox.
- Telegram/WhatsApp.

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
- **Proveedor ausente:** jobs quedan `pending`, sin consumir intentos.
- **Fallo parcial de broadcast:** anuncio persistido; destinatarios idempotentes y reanudables.
- **Sobrecarga:** lotes limitados y límite de audiencia por request.

## Rollback
- Código: retag de imágenes por `deploy.sh`.
- DB: migración aditiva; las columnas/tablas nuevas no rompen el release anterior.
- Provider: worker se mantiene inactivo si no existe `RESEND_API_KEY`.

## Gates
`pnpm install --frozen-lockfile`, typecheck, lint, tests, infra, build, diff-check, secret scan, revisión independiente, PR, CI verde, merge, backup/deploy y smoke de producción.
