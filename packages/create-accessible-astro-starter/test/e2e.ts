import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { buildManifest } from '../src/presets.js'
import { scaffoldProject } from '../src/scaffold.js'
import { PRESETS, type Preset, type ResolvedOptions } from '../src/types.js'
import { slugifySiteName } from '../src/utils.js'

const repoRoot = resolve(fileURLToPath(new URL('../../../../', import.meta.url)))

function createOptions(preset: Preset, includeLauncher: boolean, targetDir: string): ResolvedOptions {
  const siteName = `E2E ${preset}`

  return {
    targetDir,
    siteName,
    siteId: slugifySiteName(siteName),
    preset,
    includeLauncher,
  }
}

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`))
    })
  })
}

async function main(): Promise<void> {
  process.env.ACCESSIBLE_ASTRO_STARTER_TEMPLATE_DIR = repoRoot

  for (const preset of PRESETS) {
    for (const includeLauncher of [true, false]) {
      const tempRoot = await mkdtemp(join(tmpdir(), 'accessible-astro-starter-e2e-'))
      const targetDir = join(tempRoot, `${preset}-${includeLauncher ? 'launcher' : 'plain'}`)
      const options = createOptions(preset, includeLauncher, targetDir)
      const manifest = buildManifest(options)

      await scaffoldProject(options, manifest)
      await runCommand('npm', ['install'], targetDir)
      await runCommand('npm', ['run', 'build'], targetDir)
      assert.ok(true)
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(message)
  process.exitCode = 1
})
