import * as p from '@clack/prompts'
import { resolve } from 'node:path'
import { buildManifest } from './presets.js'
import { parseCliArgs, getDefaultLauncher } from './options.js'
import { scaffoldProject } from './scaffold.js'
import type { ParsedFlags, Preset, ResolvedOptions } from './types.js'
import { deriveSiteNameFromDirectory, formatPresetLabel, slugifySiteName } from './utils.js'

function unwrapPrompt<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Scaffolding cancelled.')
    process.exit(0)
  }

  return value as T
}

async function promptForTargetDir(): Promise<string> {
  return unwrapPrompt(
    await p.text({
      message: 'Where should we create your new project?',
      placeholder: './my-accessible-site',
      initialValue: './my-accessible-site',
      validate(value) {
        if (!value.trim()) {
          return 'Please choose a project directory.'
        }

        return undefined
      },
    }),
  )
}

async function promptForSiteName(initialValue: string): Promise<string> {
  return unwrapPrompt(
    await p.text({
      message: 'What should we call your site?',
      initialValue,
      validate(value) {
        if (!value.trim()) {
          return 'Please enter a site name.'
        }

        return undefined
      },
    }),
  )
}

async function promptForPreset(): Promise<Preset> {
  return unwrapPrompt(
    await p.select<Preset>({
      message: 'Which preset should we start from?',
      options: [
        {
          value: 'full',
          label: 'Full',
          hint: 'Blog, portfolio, and all demo pages',
        },
        {
          value: 'blog',
          label: 'Blog',
          hint: 'Content site with blog + contact pages',
        },
        {
          value: 'portfolio',
          label: 'Portfolio',
          hint: 'Project showcase + contact pages',
        },
        {
          value: 'minimal',
          label: 'Minimal',
          hint: 'Simple content website with home, about, and contact',
        },
        {
          value: 'barebones',
          label: 'Barebones',
          hint: 'Layout, navigation, and styles only',
        },
      ],
    }),
  )
}

async function promptForLauncher(preset: Preset): Promise<boolean> {
  return unwrapPrompt(
    await p.confirm({
      message: 'Include the Accessible Astro launcher?',
      initialValue: getDefaultLauncher(preset),
    }),
  )
}

async function resolveOptions(flags: ParsedFlags): Promise<ResolvedOptions> {
  const targetDirInput = flags.targetDir ?? (flags.yes ? './my-accessible-site' : await promptForTargetDir())
  const targetDir = resolve(process.cwd(), targetDirInput)

  const inferredSiteName = deriveSiteNameFromDirectory(targetDirInput)
  const siteName = flags.siteName ?? (flags.yes ? inferredSiteName : await promptForSiteName(inferredSiteName))
  const preset = flags.preset ?? (flags.yes ? 'full' : await promptForPreset())
  const includeLauncher =
    flags.includeLauncher ?? (flags.yes ? getDefaultLauncher(preset) : await promptForLauncher(preset))
  const siteId = slugifySiteName(siteName)

  if (!siteId) {
    throw new Error('Could not derive a valid package name from the provided site name.')
  }

  return {
    targetDir,
    siteName: siteName.trim(),
    siteId,
    preset,
    includeLauncher,
  }
}

export async function run(argv = process.argv.slice(2)): Promise<void> {
  const flags = parseCliArgs(argv)

  p.intro('Accessible Astro Starter')

  const options = await resolveOptions(flags)
  const manifest = buildManifest(options)
  const spinner = p.spinner()

  spinner.start('Scaffolding your project')
  await scaffoldProject(options, manifest)
  spinner.stop(`Created ${options.siteName}`)

  const relativeDir = options.targetDir.startsWith(process.cwd())
    ? `.${options.targetDir.slice(process.cwd().length)}`
    : options.targetDir

  p.note(
    [
      `Directory: ${relativeDir || '.'}`,
      `Preset: ${formatPresetLabel(options.preset)}`,
      `Launcher: ${options.includeLauncher ? 'Included' : 'Removed'}`,
      '',
      'Next steps:',
      `cd ${relativeDir || '.'}`,
      'npm install',
      'npm run dev',
    ].join('\n'),
    'Project ready',
  )

  p.outro('Happy building.')
}
