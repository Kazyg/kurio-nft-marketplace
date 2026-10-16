import { spawnSync } from 'node:child_process'

const result = spawnSync(
  process.execPath,
  ['x', 'playwright', 'test', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, E2E_TARGET: 'dev' },
  },
)
process.exit(result.status ?? 1)
