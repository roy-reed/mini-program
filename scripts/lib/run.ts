import { spawn, spawnSync } from 'node:child_process'

export interface CommandResult {
  stdout: string
  stderr: string
  code: number
}

function commandText(command: string, args: readonly string[]): string {
  return [command, ...args].map((part) => JSON.stringify(part)).join(' ')
}

export function runCommand(command: string, args: readonly string[], cwd?: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      const result = { stdout, stderr, code: code ?? 1 }
      if (result.code !== 0) {
        const tail = stderr.trim().split(/\r?\n/).slice(-10).join('\n')
        reject(new Error(`${commandText(command, args)} failed (exit ${result.code})\n${tail}`))
      } else resolve(result)
    })
  })
}

export async function runFfmpeg(args: readonly string[], cwd?: string): Promise<CommandResult> {
  return runCommand('ffmpeg', args, cwd)
}

export async function runFfprobe(args: readonly string[], cwd?: string): Promise<CommandResult> {
  return runCommand('ffprobe', args, cwd)
}

export function hasFfmpeg(): boolean {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
}
