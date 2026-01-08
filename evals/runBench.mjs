import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fastEvalDir = path.join(__dirname, 'fastEval');

function parseArgs(argv) {
    const args = {
        iters: 200,
        warmup: 20,
        suites: null
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--iters' && argv[i + 1]) {
            args.iters = Number(argv[++i]);
            continue;
        }
        if (arg.startsWith('--iters=')) {
            args.iters = Number(arg.split('=')[1]);
            continue;
        }
        if (arg === '--warmup' && argv[i + 1]) {
            args.warmup = Number(argv[++i]);
            continue;
        }
        if (arg.startsWith('--warmup=')) {
            args.warmup = Number(arg.split('=')[1]);
            continue;
        }
        if (arg === '--suite' && argv[i + 1]) {
            args.suites = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
            continue;
        }
        if (arg.startsWith('--suite=')) {
            args.suites = arg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
            continue;
        }
    }

    if (!Number.isFinite(args.iters) || args.iters <= 0) {
        throw new Error('Invalid --iters value');
    }
    if (!Number.isFinite(args.warmup) || args.warmup < 0) {
        throw new Error('Invalid --warmup value');
    }

    return args;
}

async function loadSuites(filter) {
    const entries = await fs.readdir(fastEvalDir, { withFileTypes: true });
    const suites = [];

    for (const dirent of entries.filter(d => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
        if (filter && !filter.includes(dirent.name)) continue;
        const suiteDir = path.join(fastEvalDir, dirent.name);
        const cnlPath = path.join(suiteDir, 'source.cnl');
        const exists = await fs.stat(cnlPath).catch(() => false);
        if (!exists) continue;

        const content = await fs.readFile(cnlPath, 'utf-8');
        suites.push({ name: dirent.name, content });
    }

    return suites;
}

function padRight(str, len) {
    return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

async function runBench() {
    const args = parseArgs(process.argv);
    const suites = await loadSuites(args.suites);
    if (suites.length === 0) {
        throw new Error('No suites found to benchmark');
    }

    const { translate } = await import('../src/cnlTranslator/index.mjs');

    console.log('UBHNL CNL Translator Benchmark');
    console.log(`Suites: ${suites.map(s => s.name).join(', ')}`);
    console.log(`Iterations: ${args.iters}, warmup: ${args.warmup}`);
    console.log('');

    for (let i = 0; i < args.warmup; i++) {
        for (const suite of suites) translate(suite.content);
    }

    const results = [];
    let totalMs = 0;

    for (const suite of suites) {
        const start = performance.now();
        for (let i = 0; i < args.iters; i++) translate(suite.content);
        const elapsed = performance.now() - start;
        totalMs += elapsed;
        results.push({
            name: suite.name,
            totalMs: elapsed,
            avgMs: elapsed / args.iters
        });
    }

    const header = [
        padRight('Suite', 28),
        padRight('iters', 8),
        padRight('total ms', 12),
        padRight('avg ms', 10)
    ].join(' | ');
    console.log(header);
    console.log('-'.repeat(header.length));
    for (const r of results) {
        const row = [
            padRight(r.name, 28),
            padRight(String(args.iters), 8),
            padRight(r.totalMs.toFixed(2), 12),
            padRight(r.avgMs.toFixed(4), 10)
        ].join(' | ');
        console.log(row);
    }

    console.log('');
    console.log(`Total time: ${totalMs.toFixed(2)} ms`);
    console.log(`Average per suite: ${(totalMs / suites.length).toFixed(2)} ms`);
}

runBench().catch((err) => {
    console.error(`Benchmark failed: ${err.message}`);
    process.exit(1);
});
