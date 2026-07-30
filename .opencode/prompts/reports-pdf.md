# Prompt: Reports (PDF)

## Goal
Generate printable PDF reports for tournament operations: lane assignments, standings, financials.

## Reportes

### Lane Assignments
- Por squad: lista de jugadores con número de carril
- Columnas: lane, player name, team, average, handicap
- Header: tournament name, squad, date

### Standings
- Full standings con rank, name, game scores, total raw, total handicap, behind
- Opción: top 10 o full field

### Financial Report
- Ingresos totales (registration fees + sidepots + brackets)
- Payouts totales
- Neto del torneo
- Desglose por tipo de fee

### Bracket Recap
- Por bracket pool: players, entry fee, total pool, payouts por posición
- Alive list (opcional)

## Implementación
- Usar `jsPDF` o `@react-pdf/renderer` en el servidor
- Endpoint: `POST /api/reports/generate` → devuelve URL del PDF
- PDFs generados se guardan en object storage (S3/R2) con TTL de 7 días
- Alternativa: generar HTML y convertirlo a PDF con Puppeteer (más control visual)

## Web
- Botón "Generate PDF" en cada sección del dashboard (standings, brackets, financial)
- Selector de tipo de reporte + opciones
- Preview antes de descargar (opcional)

## Files
- `apps/api/src/services/report.service.ts`
- `apps/web/src/app/dashboard/tournaments/[id]/reports/page.tsx`
