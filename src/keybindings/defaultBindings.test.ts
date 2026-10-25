import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cases = [
  { name: 'Windows Node', platform: 'windows', bunVersion: undefined, key: 'shift+tab' },
  { name: 'Windows Bun below VT support', platform: 'windows', bunVersion: '1.2.22', key: 'meta+m' },
  { name: 'Windows Bun at VT support', platform: 'windows', bunVersion: '1.2.23', key: 'shift+tab' },
  { name: 'Windows Bun above VT support', platform: 'windows', bunVersion: '1.4.4', key: 'shift+tab' },
  { name: 'non-Windows Node', platform: 'linux', bunVersion: undefined, key: 'shift+tab' },
  { name: 'non-Windows Bun below VT support', platform: 'macos', bunVersion: '1.2.22', key: 'shift+tab' },
] as const

const modulePath = (path: string) =>
  JSON.stringify(fileURLToPath(new URL(path, import.meta.url)))

for (const { name, platform, bunVersion, key } of cases) {
  test(`mode-cycle shortcut: ${name}`, () => {
    // Each case imports fresh defaults in a subprocess so module mocks and
    // runtime-version changes cannot leak into the shared test process.
    const script = `
      import { mock } from 'bun:test'
      mock.module(${modulePath('../utils/platform.ts')}, () => ({
        getPlatform: () => ${JSON.stringify(platform)},
      }))
      mock.module(${modulePath('../utils/bundledMode.ts')}, () => ({
        isRunningWithBun: () => ${bunVersion !== undefined},
      }))
      Object.defineProperty(process.versions, 'bun', {
        value: ${JSON.stringify(bunVersion)}, configurable: true,
      })
      const { DEFAULT_BINDINGS } = await import(${modulePath('./defaultBindings.ts')})
      const chat = DEFAULT_BINDINGS.find(block => block.context === 'Chat')
      const keys = Object.entries(chat.bindings)
        .filter(([, action]) => action === 'chat:cycleMode')
        .map(([key]) => key)
      console.log(JSON.stringify(keys))
    `
    const result = spawnSync(process.execPath, ['--eval', script], {
      encoding: 'utf8',
      timeout: 10_000,
    })
    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual([key])
    // Allow child startup and its 10-second deadline before the test timeout.
  }, 15_000)
}
