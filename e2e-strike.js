const { chromium } = require('playwright')

const BASE = 'http://178.104.71.198:3000'
const results = []

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️'
  results.push({ test, status, detail })
  console.log(`${icon} ${test}${detail ? ' — ' + detail : ''}`)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('requestfailed', req => errors.push('REQ: ' + req.url()))

  // ═══ LANDING ═══
  console.log('\n═══ LANDING ═══')
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')

  log('Title', await page.title() === 'Strike Manager' ? 'PASS' : 'FAIL', await page.title())
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  log('Dark theme', bg === 'rgb(10, 10, 20)' ? 'PASS' : 'FAIL', bg)
  const h1Size = await page.locator('h1').first().evaluate(el => getComputedStyle(el).fontSize)
  log('Hero size ≥ 48px', parseFloat(h1Size) >= 48 ? 'PASS' : 'FAIL', h1Size)
  log('Nav Sign in', await page.locator('a:has-text("Sign in")').count() > 0 ? 'PASS' : 'FAIL')
  log('Nav Get started', await page.locator('a:has-text("Get started")').count() > 0 ? 'PASS' : 'FAIL')
  log('Feature: Tournaments', await page.locator('text=Tournament Management').count() > 0 ? 'PASS' : 'FAIL')
  log('Feature: Brackets', await page.locator('text=Brackets').count() > 0 ? 'PASS' : 'FAIL')
  log('Feature: Standings', await page.locator('text=Live Standings').count() > 0 ? 'PASS' : 'FAIL')
  const bodyText = await page.evaluate(() => document.body.innerText)
  log('No emojis', !/[\u{1F300}-\u{1F9FF}]/u.test(bodyText) ? 'PASS' : 'FAIL')

  await page.screenshot({ path: '/tmp/e2e/01-landing.png', fullPage: true })

  // ═══ SIGNUP ═══
  console.log('\n═══ SIGNUP ═══')
  await page.goto(`${BASE}/signup`)
  await page.waitForLoadState('networkidle')

  const testEmail = `e2e${Date.now()}@strike.app`
  await page.fill('#firstName', 'E2E')
  await page.fill('#lastName', 'Tester')
  await page.fill('#email', testEmail)
  await page.fill('#password', 'test1234')
  await page.click('button[type=submit]')

  try {
    await page.waitForURL('**/dashboard**', { timeout: 10000 })
    log('Signup → dashboard', 'PASS', page.url())
  } catch {
    log('Signup → dashboard', 'FAIL', 'Timeout')
  }

  // ═══ DASHBOARD ═══
  console.log('\n═══ DASHBOARD ═══')
  // Wait for content to actually render (not just networkidle)
  await await page.locator("h1").first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(2000) // Let queries resolve

  const dashText = await page.evaluate(() => document.body.innerText)
  log('Dashboard has content', dashText.length > 100 ? 'PASS' : 'FAIL', `${dashText.length} chars`)

  const dashBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  log('Dashboard dark theme', dashBg === 'rgb(10, 10, 20)' ? 'PASS' : 'FAIL', dashBg)

  log('Dashboard heading', await page.locator('h1:has-text("Dashboard")').count() > 0 ? 'PASS' : 'FAIL')
  log('Create button', await page.locator('a:has-text("Create Tournament")').count() > 0 ? 'PASS' : 'FAIL')
  log('Stats cards', await page.locator('text=Active').count() > 0 ? 'PASS' : 'FAIL')

  await page.screenshot({ path: '/tmp/e2e/02-dashboard.png', fullPage: true })

  // ═══ TOURNAMENT CREATION ═══
  console.log('\n═══ TOURNAMENT CREATION ═══')
  await page.click('a:has-text("Create Tournament")')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  const newUrl = page.url()
  log('New tournament page', newUrl.includes('/new') ? 'PASS' : 'FAIL', newUrl)

  await page.screenshot({ path: '/tmp/e2e/03-new-tournament.png', fullPage: true })

  // Check form fields
  log('Name input', await page.locator('input[name="name"], #name, input[placeholder*="name" i]').count() > 0 ? 'PASS' : 'FAIL')
  log('Date input', await page.locator('input[type="date"], input[type="datetime-local"], input[placeholder*="date" i]').count() > 0 ? 'PASS' : 'FAIL')

  // ═══ LOGIN FLOW ═══
  console.log('\n═══ LOGIN ═══')
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')

  await page.fill('#email', testEmail)
  await page.fill('#password', 'test1234')
  await page.click('button[type=submit]')

  try {
    await page.waitForURL('**/dashboard**', { timeout: 10000 })
    log('Login → dashboard', 'PASS', page.url())
  } catch {
    log('Login → dashboard', 'FAIL', 'Timeout')
  }

  // ═══ AUTH PROTECTION ═══
  console.log('\n═══ AUTH PROTECTION ═══')
  const noAuthCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const noAuthPage = await noAuthCtx.newPage()
  await noAuthPage.goto(`${BASE}/dashboard`)
  await noAuthPage.waitForLoadState('networkidle')
  await noAuthPage.waitForTimeout(2000)
  const noAuthUrl = noAuthPage.url()
  log('Unauth → login redirect', noAuthUrl.includes('/login') ? 'PASS' : 'WARN', noAuthUrl)
  await noAuthCtx.close()

  // ═══ CONSOLE ERRORS ═══
  console.log('\n═══ CONSOLE ═══')
  log('No console errors', errors.length === 0 ? 'PASS' : 'WARN', `${errors.length} errors`)
  errors.slice(0, 5).forEach(e => console.log(`  ⚠️ ${e.substring(0, 100)}`))

  // ═══ SUMMARY ═══
  console.log('\n═══════════════════════════════════════════')
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const warned = results.filter(r => r.status === 'WARN').length
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed} | WARN: ${warned}`)

  if (failed > 0) {
    console.log('\n❌ FAILED:')
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.test}: ${r.detail}`))
  }

  await browser.close()
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
