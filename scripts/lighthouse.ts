import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync, spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { auditConfig } from './lighthouse-config.js'

const origin = process.env.LIGHTHOUSE_ORIGIN || 'http://127.0.0.1:4175'
const nodeVersion = execFileSync('node', ['--version'], {
  encoding: 'utf8',
}).trim()
const directory = resolve('reports/phase-5b/lighthouse')
await mkdir(directory, { recursive: true })

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.goto(`${origin}/diagnostics`)
  await expect(page.getByTestId('http-status')).toHaveText('HTTP conectado')
  await expect(page.getByTestId('socket-status')).toHaveText(
    'Socket.IO conectado',
  )
  for (const target of auditConfig.pages) {
    await page.goto(`${origin}${target.path}`)
    await expect(page.locator('h1')).toBeVisible()
    await expect(
      page.locator('img[src*="emerald"]:visible').first(),
    ).toBeVisible()
  }
} finally {
  await browser.close()
}

interface Report {
  categories: Record<string, { score: number }>
  audits: Record<string, { numericValue?: number }>
  configSettings: unknown
  environment: unknown
  lighthouseVersion: string
  runtimeError?: unknown
  runWarnings: string[]
}
const median = (values: number[]) => [...values].sort((a, b) => a - b)[1]!
const measurements = []
for (const page of auditConfig.pages) {
  for (const profile of auditConfig.profiles) {
    const reports: Report[] = []
    for (let run = 1; run <= 3; run++) {
      const output = resolve(directory, `${page.name}-${profile}-${run}`)
      const args = [
        'node_modules/lighthouse/cli/index.js',
        `${origin}${page.path}`,
        '--chrome-flags=--headless=new',
        '--output=html',
        '--output=json',
        `--output-path=${output}`,
        '--only-categories=performance,accessibility,best-practices,seo',
        '--throttling-method=simulate',
        '--quiet',
        ...(profile === 'desktop' ? ['--preset=desktop'] : []),
      ]
      console.log(`Lighthouse ${page.name} ${profile}: ${run}/3`)
      await new Promise<void>((resolveRun, reject) => {
        const child = spawn('node', args, {
          stdio: 'inherit',
          env: {
            ...process.env,
            CHROME_PATH: process.env.CHROME_PATH || chromium.executablePath(),
          },
        })
        child.on('error', reject)
        child.on('close', (code) =>
          code === 0
            ? resolveRun()
            : reject(new Error(`Lighthouse terminou com código ${code}`)),
        )
      })
      const report = JSON.parse(
        await readFile(`${output}.report.json`, 'utf8'),
      ) as Report
      if (report.runtimeError)
        throw new Error(JSON.stringify(report.runtimeError))
      reports.push(report)
    }
    const scores = Object.fromEntries(
      Object.keys(auditConfig.thresholds).map((category) => [
        category,
        median(
          reports.map((report) => report.categories[category]!.score * 100),
        ),
      ]),
    )
    measurements.push({
      page: page.name,
      profile,
      scores,
      lcp: median(
        reports.map((r) => r.audits['largest-contentful-paint']!.numericValue!),
      ),
      cls: median(
        reports.map((r) => r.audits['cumulative-layout-shift']!.numericValue!),
      ),
      tbt: median(
        reports.map((r) => r.audits['total-blocking-time']!.numericValue!),
      ),
      runs: reports.map((r) => ({
        scores: Object.fromEntries(
          Object.entries(r.categories).map(([key, value]) => [
            key,
            value.score * 100,
          ]),
        ),
        warnings: r.runWarnings,
      })),
      settings: reports[0]!.configSettings,
      environment: reports[0]!.environment,
      lighthouseVersion: reports[0]!.lighthouseVersion,
    })
    await writeFile(
      resolve(directory, 'summary.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          origin,
          platform: process.platform,
          node: nodeVersion,
          orchestrator: {
            bun: process.versions.bun,
            nodeCompatibility: process.version,
          },
          chromium: chromium.executablePath(),
          cache:
            'Novo perfil Chromium por medição; limpeza de storage/cache padrão Lighthouse. MSW inicia normalmente, IndexedDB usa seed padrão, visitante não autenticado.',
          measurements,
        },
        null,
        2,
      ),
    )
    const latest = measurements.at(-1)!
    console.log(
      JSON.stringify({
        page: latest.page,
        profile,
        scores,
        lcp: latest.lcp,
        cls: latest.cls,
        tbt: latest.tbt,
      }),
    )
  }
}
if (
  measurements.some((measurement) =>
    Object.entries(auditConfig.thresholds).some(
      ([category, minimum]) => measurement.scores[category]! < minimum,
    ),
  )
)
  process.exitCode = 1
