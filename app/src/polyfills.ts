import { Buffer } from 'buffer'
import process from 'process'

// Ensure Node globals exist before any other module executes
const globalAny = globalThis as any

if (!globalAny.Buffer) {
  globalAny.Buffer = Buffer
}

if (!globalAny.process) {
  globalAny.process = process
} else {
  const processPolyfill = process as unknown as Record<string, unknown>
  for (const key of Object.keys(processPolyfill)) {
    if (!(key in globalAny.process)) {
      globalAny.process[key] = processPolyfill[key]
    }
  }
}

globalAny.process.env = globalAny.process.env || {}
globalAny.process.browser = true
globalAny.global = globalAny.global || globalThis
