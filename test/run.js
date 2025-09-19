#!/usr/bin/env node
import assert from 'node:assert'

async function main() {
  const tests = [
    './test_graph_basic.mjs',
    './test_iterators.mjs',
    './test_edges.mjs',
    './test_fluent_explain_then.mjs',
    './test_vertex_traversals.mjs',
    './test_edge_traversals.mjs',
    './test_filters_and_endpoints.mjs',
    './test_api_inputs_and_drop.mjs',
    './test_V_isolated.mjs',
    './test_E_isolated.mjs',
  ];
  let passed = 0;
  for (const t of tests) {
    try {
      await import(new URL(t, import.meta.url));
      console.log('ok', t);
      passed++;
    } catch (e) {
      console.error('FAIL', t, e);
      process.exitCode = 1;
    }
  }
  console.log(`\n${passed}/${tests.length} test files passed`)
}

main();
