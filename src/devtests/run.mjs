#!/usr/bin/env node

import { spawnSync } from 'child_process';

async function main() {
  const args = process.argv.slice(2);
  const perfIndex = args.indexOf('--perf');

  if (perfIndex !== -1) {
    const perfArgs = args.slice(perfIndex + 1);
    const result = spawnSync(process.execPath, ['evals/runPerfBench.mjs', ...perfArgs], {
      stdio: 'inherit'
    });
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
    }
    return;
  }

  console.log('No dev tests implemented yet.');
  console.log('Use: node src/devtests/run.mjs --perf [--bench=1,2,3,4] [--runs=5]');
}

main().catch((err) => {
  console.error('Devtests fatal:', err);
  process.exitCode = 1;
});
