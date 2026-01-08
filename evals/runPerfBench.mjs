import { performance } from 'perf_hooks';
import os from 'os';

import { Kernel } from '../src/kernel/index.mjs';
import { compileStatements } from '../src/compiler/ubh-compiler.mjs';
import { Vocabulary } from '../src/frontend/schema/vocab.mjs';
import { assertStmt, constRef, pred } from '../src/frontend/logic/ast.mjs';
import { parseCnlToTypedAst } from '../src/frontend/cnl/typing.mjs';
import { Session } from '../src/session/index.mjs';

function parseArgs(argv) {
    const args = {
        benches: new Set(['1', '2', '3', '4']),
        runs: 5
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--bench' && argv[i + 1]) {
            args.benches = new Set(argv[++i].split(',').map(s => s.trim()).filter(Boolean));
            continue;
        }
        if (arg.startsWith('--bench=')) {
            args.benches = new Set(arg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean));
            continue;
        }
        if (arg === '--runs' && argv[i + 1]) {
            args.runs = Number(argv[++i]);
            continue;
        }
        if (arg.startsWith('--runs=')) {
            args.runs = Number(arg.split('=')[1]);
            continue;
        }
    }

    if (!Number.isFinite(args.runs) || args.runs <= 0) {
        throw new Error('Invalid --runs value');
    }

    return args;
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted[mid];
}

function formatMachine() {
    return `${os.cpus()?.[0]?.model || 'unknown'}, ${(os.totalmem() / (1024 ** 3)).toFixed(1)} GB, ${os.platform()} ${os.release()}, Node ${process.version}`;
}

function buildCnlInput(count) {
    const lines = new Array(count);
    for (let i = 0; i < count; i++) {
        lines[i] = `p${i} has Fever.`;
    }
    return lines.join('\n');
}

function buildCnlVocab(count) {
    const vocab = new Vocabulary();
    vocab.addDomain('Person');
    vocab.addDomain('Symptom');
    vocab.addPred('Has', ['Person', 'Symptom']);
    vocab.addConst('Fever', 'Symptom');
    for (let i = 0; i < count; i++) {
        vocab.addConst(`p${i}`, 'Person');
    }
    return vocab;
}

function benchParsing(runs) {
    const cnl = buildCnlInput(10000);
    const vocab = buildCnlVocab(10000);
    const times = [];
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        parseCnlToTypedAst(cnl, vocab, { updateVocab: false });
        const elapsed = performance.now() - start;
        times.push(elapsed);
    }
    return { runs: times, median: median(times) };
}

function buildCompilationInput(count) {
    const vocab = new Vocabulary();
    vocab.addDomain('Person');
    vocab.addPred('Trusts', ['Person', 'Person']);
    for (let i = 0; i <= count; i++) {
        vocab.addConst(`p${i}`, 'Person');
    }

    const statements = new Array(count);
    for (let i = 0; i < count; i++) {
        statements[i] = assertStmt(pred('Trusts', [
            constRef(`p${i}`, 'Person'),
            constRef(`p${i + 1}`, 'Person')
        ]));
    }

    return { vocab, statements };
}

function benchCompilation() {
    const { vocab, statements } = buildCompilationInput(100000);
    const kernel = new Kernel();
    const start = performance.now();
    compileStatements(statements, { kernel, vocab });
    const elapsed = performance.now() - start;
    return { elapsed, wires: kernel.count() };
}

function benchKernelMemory() {
    const kernel = new Kernel({ enableHashCons: false });
    const before = process.memoryUsage().rss;
    for (let i = 0; i < 1_000_000; i++) {
        kernel.addAtom(`a${i}`);
    }
    const after = process.memoryUsage().rss;
    return {
        wires: kernel.count(),
        rssMb: (after / (1024 ** 2)).toFixed(1),
        deltaMb: ((after - before) / (1024 ** 2)).toFixed(1)
    };
}

function buildQuerySession() {
    const session = new Session();
    for (let i = 0; i < 100; i++) {
        const pred = `P${i}`;
        for (let j = 0; j < 10; j++) {
            session.addFact(pred, [`c${j}`]);
        }
        session.addRule({
            if: [{ pred, args: ['$x'] }],
            then: { pred: `Q${i}`, args: ['$x'] }
        });
    }
    return session;
}

function benchQuery(runs) {
    const times = [];
    for (let i = 0; i < runs; i++) {
        const session = buildQuerySession();
        const goal = { pred: 'Q42', args: ['c3'] };
        const start = performance.now();
        const ok = session.query(goal, { maxIterations: 1 });
        const elapsed = performance.now() - start;
        if (!ok) throw new Error('Query benchmark failed to derive goal');
        times.push(elapsed);
    }
    return { runs: times, median: median(times) };
}

function printHeader(title) {
    console.log(title);
    console.log('Machine:', formatMachine());
}

function printRuns(times) {
    console.log('Runs (ms):', `[${times.map(t => t.toFixed(2)).join(', ')}]`);
    console.log('Median (ms):', median(times).toFixed(2));
}

function main() {
    const args = parseArgs(process.argv);

    if (args.benches.has('1')) {
        printHeader('Benchmark 1: CNL Parsing (10k lines)');
        const result = benchParsing(args.runs);
        printRuns(result.runs);
        console.log('Target: < 1000 ms');
        console.log('');
    }

    if (args.benches.has('2')) {
        printHeader('Benchmark 2: UBH Compilation (100k instances)');
        const result = benchCompilation();
        console.log('Time (ms):', result.elapsed.toFixed(2));
        console.log('Wires:', result.wires);
        console.log('Target: < 2000 ms');
        console.log('');
    }

    if (args.benches.has('3')) {
        printHeader('Benchmark 3: Kernel Memory (1e6 wires)');
        const result = benchKernelMemory();
        console.log('Wires:', result.wires);
        console.log('RSS (MB):', result.rssMb);
        console.log('Delta RSS (MB):', result.deltaMb);
        console.log('Target: successful completion without OOM');
        console.log('');
    }

    if (args.benches.has('4')) {
        printHeader('Benchmark 4: Query Latency (1k facts, 100 rules)');
        const result = benchQuery(args.runs);
        printRuns(result.runs);
        console.log('Target: < 200 ms');
        console.log('');
    }
}

try {
    main();
} catch (err) {
    console.error(`Perf benchmark failed: ${err.message}`);
    process.exit(1);
}
