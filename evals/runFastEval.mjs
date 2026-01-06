import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

// --- UTILS ---
const COLORS = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    dim: "\x1b[2m"
};

function color(text, colorName) {
    return `${COLORS[colorName] || ''}${text}${COLORS.reset}`;
}

function pad(str, len) {
    return (str + ' '.repeat(len)).slice(0, len);
}

// --- MOCK SESSION SKELETON (Fails by default) ---
class MockSession {
    constructor() {
        this.loadedFiles = [];
    }

    async loadTheoryFile(filePath) {
        try {
            await fs.stat(filePath);
            this.loadedFiles.push(path.basename(filePath));
            return { ok: true, docId: path.basename(filePath) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    async query(input, kind) {
        // SKELETON: Since implementation is missing, we simply return NOT_IMPLEMENTED or UNKNOWN.
        // This ensures tests FAIL until valid logic is hooked up.
        await new Promise(resolve => setTimeout(resolve, 10));
        return { status: 'ERROR', note: 'Not Implemented' };
    }
}

// --- TEST RUNNER ---

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAST_EVAL_DIR = path.join(__dirname, 'fastEval');

async function runTests() {
    console.log(color("UBHNL FastEval Suite (Strict Verification Mode)", "cyan"));
    console.log(color("===============================================", "cyan"));

    const suiteConfig = JSON.parse(await fs.readFile(path.join(FAST_EVAL_DIR, 'suite.json'), 'utf-8'));

    const results = [];
    const startTotal = performance.now();

    for (const suite of suiteConfig) {
        const suiteDir = path.join(FAST_EVAL_DIR, suite.directory);
        const testDefPath = path.join(suiteDir, 'test.json');

        if (!await fs.stat(testDefPath).catch(() => false)) {
            console.warn(color(`Skipping ${suite.id}: test.json not found.`, "yellow"));
            continue;
        }

        const testDef = JSON.parse(await fs.readFile(testDefPath, 'utf-8'));
        console.log(`\nRunning Suite: ${color(suite.id, "blue")} (${suite.description})`);

        const session = new MockSession();

        // Load all .dsl/.cnl files in the dir
        const dirFiles = await fs.readdir(suiteDir);
        const theoryFiles = dirFiles.filter(f => f.endsWith('.dsl') || f.endsWith('.cnl'));

        for (const file of theoryFiles) {
            await session.loadTheoryFile(path.join(suiteDir, file));
        }

        for (const testCase of testDef) {
            process.stdout.write(`\n  ${color("•", "cyan")} ${testCase.description || testCase.input}\n`);

            const startTest = performance.now();
            const result = await session.query(testCase.input, testCase.kind);
            const endTest = performance.now();
            const duration = (endTest - startTest).toFixed(2);

            let passed = true;
            if (result.status !== testCase.expected) passed = false;
            if (testCase.witness) {
                if (!result.witness || JSON.stringify(result.witness) !== JSON.stringify(testCase.witness)) passed = false;
            }

            results.push({
                suite: suite.id,
                input: testCase.input,
                description: testCase.description || testCase.input,
                expected: testCase.expected,
                got: result.status,
                passed: passed,
                duration: duration
            });

            const indent = "      ";
            console.log(`${indent}Action:   ${testCase.kind}`);
            console.log(`${indent}Input:    ${testCase.input}`);
            console.log(`${indent}Expected: ${testCase.expected}`);

            if (passed) {
                console.log(`${indent}Got:      ${color(result.status, "green")}`);
                console.log(`${indent}Result:   ${color(`PASS (${duration}ms)`, "green")}`);
            } else {
                console.log(`${indent}Got:      ${color(result.status, "red")} (${result.note || ''})`);
                console.log(`${indent}Result:   ${color(`FAIL (${duration}ms)`, "red")}`);
            }
        }
    }

    const endTotal = performance.now();

    // --- TABLE REPORT ---
    console.log("\n" + color("Execution Summary", "cyan"));
    console.log(color("--------------------------------------------------------------------------------------", "dim"));
    console.log(
        "| " + pad("Suite", 16) +
        " | " + pad("Description", 30) +
        " | " + pad("Exp", 8) +
        " | " + pad("Got", 8) +
        " | " + pad("Time (ms)", 9) + " |"
    );
    console.log(color("--------------------------------------------------------------------------------------", "dim"));

    let passedCount = 0;
    for (const r of results) {
        if (r.passed) passedCount++;
        // Truncate description if too long
        let descDisp = r.description.length > 27 ? r.description.substring(0, 27) + "..." : r.description;
        descDisp = pad(descDisp, 30);

        const statusColor = r.passed ? "green" : "red";
        const gotText = color(pad(r.got, 8), statusColor);

        console.log(
            `| ${pad(r.suite, 16)} | ${descDisp} | ${pad(r.expected, 8)} | ${gotText} | ${pad(r.duration, 9)} |`
        );
    }
    console.log(color("--------------------------------------------------------------------------------------", "dim"));

    const totalTime = (endTotal - startTotal).toFixed(0);
    console.log(`Total Time: ${totalTime}ms`);

    const scoreColor = passedCount === results.length ? "green" : "red";
    console.log(`Tests Passed: ${color(`${passedCount}/${results.length}`, scoreColor)}`);

    if (passedCount < results.length) {
        console.log(color("\nFAILURE: System implementation missing or incorrect.", "red"));
        process.exit(1);
    } else {
        console.log(color("\nSUCCESS: All systems operational.", "green"));
        process.exit(0);
    }
}

runTests().catch(console.error);
