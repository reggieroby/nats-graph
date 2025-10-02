#!/usr/bin/env node
import { run } from 'node:test'
import { tap } from 'node:test/reporters'
import path from 'path';


run({
  concurrency: false,
  files: [
    path.resolve(import.meta.dirname, 'test_nats_connection.mjs'),
  ]
})
  .on('test:fail', () => {
    process.exitCode = 1;
  })
  .compose(tap)
  .pipe(process.stdout);