import { chromium } from 'playwright'

const shots = [
  { name: 'check_mobile', width: 390, height: 844 },
  { name: 'check_tablet', width: 700, height: 900 },
  { name: 'check_desktop', width: 1440, height: 900 },
]

const browser = await chromium.launch({ channel: 'msedge' })

for (const { name, width, height } of shots) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  // Esperar a que el loader desaparezca (escena lista)
  await page.waitForSelector('.loader', { state: 'detached', timeout: 25000 })
  // Captura inicial (sin scroll) para ver el estado post-carga
  await page.screenshot({ path: `tools/${name}_top.png` })
  // Scroll hasta que las notas de ingredientes sean visibles (progress > 0.5)
  await page.evaluate(() => {
    const hero = document.querySelector('.hero-section')
    const dist = hero.offsetHeight - window.innerHeight
    window.scrollTo(0, dist * 0.6)
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `tools/${name}_notes.png` })
  await page.close()
}

await browser.close()
console.log('done')
