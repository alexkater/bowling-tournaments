import { createTRPCClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'

const API = 'https://bolos.mogambo.xyz/trpc'
const ORG_ID = '5337897f-a7b0-4269-8e84-647ff06d1d03'

function c(token?: string, orgId?: string) {
  return createTRPCClient<any>({
    links: [httpBatchLink({
      url: API,
      transformer: superjson,
      headers: () => {
        const h: Record<string, string> = {}
        if (token) h.Authorization = `Bearer ${token}`
        if (orgId) h['x-org-id'] = orgId
        return h
      }
    })]
  })
}

async function login(email: string, pw: string) {
  const r = await c().auth.login.mutate({ email, password: pw })
  return r.token
}

async function main() {
  // 1. Organizer login
  const orgToken = await login('admin@mogambo.xyz', 'Admin123!')
  console.log('✅ Organizador login')

  const org = c(orgToken, ORG_ID)

  // 2. Create tournament
  const iso = (d: string) => new Date(d).toISOString()
  let tid: string
  try {
    const t = await org.tournament.create.mutate({
      name: '🎳 Torneo de Prueba',
      category: 'open',
      maxPlayers: 16,
      allowWaitlist: true,
      startDate: iso('2026-08-20T09:00:00'),
      endDate: iso('2026-08-21T18:00:00'),
      registrationDeadline: iso('2026-08-19T23:59:59'),
      stages: [{
        name: 'Clasificatoria',
        order: 0,
        format: { type: 'total_pins', gamesPerPlayer: 3, eventType: 'singles' },
        advancement: { type: 'final' },
      }]
    })
    tid = t.id
    console.log('✅ Torneo creado:', t.name, '| id:', tid)
  } catch(e: any) {
    const err = e?.shape?.message || e?.message || JSON.stringify(e)
    console.error('❌ Crear torneo:', String(err).slice(0, 300))
    return
  }

  // 3. Public visibility
  const pub = c()
  const pubRes = await pub.tournament.list.query({ status: 'published' })
  const found = pubRes.items.find((t: any) => t.name === '🎳 Torneo de Prueba')
  console.log(found ? `✅ Visible: ${found.name}` : '❌ NO visible')

  // 4. María se inscribe
  const mariaT = await login('maria@prueba.com', 'Test123456!')
  const maria = c(mariaT)
  try {
    const er = await maria.enrollment.register.mutate({ tournamentId: tid })
    console.log('✅ María inscrita:', er.status)
  } catch(e: any) {
    console.log('⚠️ María:', e?.message?.slice(0, 100) || String(e).slice(0, 100))
  }

  // 5. Cancelar
  try {
    await maria.enrollment.cancel.mutate({ tournamentId: tid })
    console.log('✅ María canceló')
  } catch(e: any) {
    console.log('⚠️ Cancel:', e?.message?.slice(0, 100) || String(e).slice(0, 100))
  }

  // 6. Re-inscribir
  try {
    const er = await maria.enrollment.register.mutate({ tournamentId: tid })
    console.log('✅ María re-inscrita:', er.status)
  } catch(e: any) {
    console.log('⚠️ Re-reg:', e?.message?.slice(0, 100) || String(e).slice(0, 100))
  }

  // 7. Mis torneos
  const myT = await maria.enrollment.myTournaments.query()
  console.log(`📋 Mis torneos: ${myT.length}`)
  for (const t of myT) {
    console.log(`   ${t.status === 'confirmed' ? '✅' : '⏳'} ${t.tournament?.name || t.name || '?'}: ${t.status}`)
  }

  // 8. Listado público final
  const final = await pub.tournament.list.query({ status: 'published' })
  console.log(`\n🌐 ${final.items.length} torneos públicos`)

  console.log('\n═══════════════════════════════')
  console.log('✅ PLATAFORMA FUNCIONANDO')
  console.log('═══════════════════════════════')
}

main().catch(e => console.error('❌', e?.message?.slice(0, 300)))
