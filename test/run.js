#!/usr/bin/env node
import { run } from 'node:test'
import { spec } from 'node:test/reporters'
import path from 'path'
import fs from 'node:fs'

const outputDir = path.resolve(import.meta.dirname, 'output')
fs.mkdirSync(outputDir, { recursive: true })
const now = Date.now()
// Reverse-lexicographically sortable prefix: smaller for newer timestamps
// Use MAX_SAFE_INTEGER to keep arithmetic precise and width fixed
const MAX_SAFE = Number.MAX_SAFE_INTEGER
const reverseKey = (BigInt(MAX_SAFE) - BigInt(now)).toString().padStart(String(MAX_SAFE).length, '0')

// Clear, human-readable timestamp alongside the reverse key
const timestamp = new Date(now).toISOString().replace(/[:.]/g, '-')

// Example: 0000...123__results-2025-10-03T12-34-56-789Z.txt
const outputFile = path.resolve(outputDir, `${reverseKey}__results-${timestamp}.txt`)
const fileStream = fs.createWriteStream(outputFile)

const stream = run({
  concurrency: true,
  globPatterns: [
    path.resolve(import.meta.dirname, 'graph.mjs'),
    path.resolve(import.meta.dirname, 'kvStoreProvider', '**.mjs'),
    path.resolve(import.meta.dirname, 'steps', '**.mjs'),
    "!" + path.resolve(import.meta.dirname, '**/*.shared.mjs'),
  ]
})
  .on('test:fail', () => {
    process.exitCode = 1;
  })
  .compose(spec)

stream.pipe(process.stdout)
stream.pipe(fileStream)

// Ensure the process exits after tests complete and the file is flushed
stream.once('end', () => {
  if (!fileStream.closed) fileStream.end()
})
fileStream.once('finish', () => {
  process.exit(process.exitCode ?? 0)
})
