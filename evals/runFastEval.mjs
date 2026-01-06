import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fastEvalDir = path.join(__dirname, 'fastEval');

// --- COLORS ---
const COLORS = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    dim: "\x1b[2m"
};

function color(text, col) {
    return (COLORS[col] || "") + text + COLORS.reset;
}

// Helper to pad strings considering ANSI colors
function pad(str, len) {
    str = String(str);
    const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
    if (visibleLen >= len) return str;
    return str + " ".repeat(len - visibleLen);
}

// --- MOCK SESSION (Simulated) ---
class MockSession {
    constructor() {
        this.kb = [];
    }
    async loadTheoryFile(filepath) {
        // Simulate loading
    }
    async query(input, kind) {
        // Simple mock responses for "boolean" suite based on input keywords
        // This is a placeholder until the real engine is connected
        if (input.includes('implies $a $b')) return { status: 'OK' }; // Rules
        if (input.includes('$rule')) return { status: 'OK' }; // Assertions

        // Contradiction suite mocks
        if (input.includes('IsA switch1 Switch')) return { status: 'OK' };

        // Default ERROR for everything else to prove tests define "Expected" behavior
        // And we see the FAILs
        return { status: 'ERROR', note: 'Not implemented' };
    }
}

async function runTests() {
    console.log(color("UBHNL FastEval Suite (Strict Verification Mode)", "green"));
    console.log("=".repeat(120));

    const suites = await fs.readdir(fastEvalDir, { withFileTypes: true });
    let results = [];

    const startTotal = performance.now();

    for (const dirent of suites) {
        if (!dirent.isDirectory()) continue;
        const suiteDir = path.join(fastEvalDir, dirent.name);

        // Load suite metadata if exists, else infer
        const suite = { id: dirent.name, description: "Unknown Suite" };

        const testDefPath = path.join(suiteDir, 'test.json');
        if (!await fs.stat(testDefPath).catch(() => false)) continue;

        const testDef = JSON.parse(await fs.readFile(testDefPath, 'utf-8'));
        
        // Load proof.cnl
        const proofPath = path.join(suiteDir, 'proof.cnl');
        let proofContent = null;
        if (await fs.stat(proofPath).catch(() => false)) {
             proofContent = await fs.readFile(proofPath, 'utf-8');
             proofContent = proofContent.trim();
        }

        console.log(`\nRunning Suite: ${color(suite.id, "blue")}`);

        const session = new MockSession();

        // --- TRANSLATION AND LOADING ---
        let translationPassed = true;
        let finalSys2 = "";

        try {
            const cnlPath = path.join(suiteDir, 'source.cnl');
            const sys2ExpectedPath = path.join(suiteDir, 'expected.sys2');

            // 1. Check if files exist
            const hasCnl = await fs.stat(cnlPath).catch(() => false);
            const hasSys2 = await fs.stat(sys2ExpectedPath).catch(() => false);

            if (hasCnl && hasSys2) {
                const cnlContent = await fs.readFile(cnlPath, 'utf-8');
                const expectedSys2 = await fs.readFile(sys2ExpectedPath, 'utf-8');

                // 2. Run Translation
                const { translate } = await import('../src/cnlTranslator/index.mjs');
                const generatedSys2 = translate(cnlContent);

                // 3. Normalize for comparison (trim whitespace)
                const normGen = generatedSys2.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).join('\n');
                const normExp = expectedSys2.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).join('\n');

                if (normGen !== normExp) {
                    translationPassed = false;
                    console.log(color(`  [TRANSLATION FAIL]`, "red"));
                    console.log(color(`   Expected:\n${normExp}`, "dim"));
                    console.log(color(`   Got:\n${normGen}`, "dim"));
                } else {
                    console.log(color(`  [TRANSLATION PASS]`, "green"));
                    finalSys2 = generatedSys2;
                }
            } else {
                // Fallback for non-CNL suites
                const dirFiles = await fs.readdir(suiteDir);
                const legacyFiles = dirFiles.filter(f => f.endsWith('.dsl') || f.endsWith('.sys2'));
                for (const file of legacyFiles) await session.loadTheoryFile(path.join(suiteDir, file));

                if (legacyFiles.length === 0 && (!hasCnl || !hasSys2)) {
                    console.log(color(`  [WARN] No source files found`, "yellow"));
                    translationPassed = null; // N/A
                }
            }
        } catch (err) {
            console.error(color(`  [TRANSLATION ERROR] ${err.message}`, "red"));
            translationPassed = false;
        }

        for (const testCase of testDef) {
            process.stdout.write(`\n  ${color("•", "cyan")} ${testCase.description || testCase.input}\n`);

            const startTest = performance.now();
            const result = await session.query(testCase.input, testCase.kind);
            const endTest = performance.now();
            const duration = (endTest - startTest).toFixed(2);

            // Detailed Checks
            const reasonPassed = result.status !== 'ERROR';
            const correctPassed = result.answer === testCase.expected;
            const proofPassed = proofContent && result.proof && result.proof.trim() === proofContent;

            // Overall Pass?
            // If we require EVERYTHING:
            // const passed = reasonPassed && correctPassed && proofPassed;
            // But for now, we just log "FAIL" for reason if reason failed.
            // The logic was: result.status !== testCase.expected.
            // But testCase.expected is now "Yes, ...". result.status is "OK" or "ERROR".
            // So result.status !== expected is ALWAYS true (FAIL).
            // We should decouple "Reasoning Status" from "Correct Answer".
            
            // For the summary table, we track all 3.
            
            results.push({
                suite: suite.id,
                description: testCase.description || testCase.input,
                translationPassed: translationPassed,
                reasonPassed: reasonPassed,
                correctPassed: correctPassed,
                proofPassed: proofPassed,
                duration: duration
            });

            const indent = "      ";
            if (reasonPassed && correctPassed && proofPassed) {
                console.log(`${indent}Result:   ${color(`PASS`, "green")}`);
            } else {
                console.log(`${indent}Reason:   ${reasonPassed ? color("PASS", "green") : color("FAIL", "red")}`);
                console.log(`${indent}Correct:  ${correctPassed ? color("PASS", "green") : color("FAIL", "red")}`);
                console.log(`${indent}Proof:    ${proofPassed ? color("PASS", "green") : color("FAIL", "red")}`);
            }
        }
    }

    const endTotal = performance.now();

    // --- TABLE REPORT ---
    console.log("\n" + color("Execution Summary", "cyan"));
    const line = color("-".repeat(110), "dim");
    console.log(line);
    console.log(
        "| " + pad("Suite", 16) +
        " | " + pad("Description", 30) +
        " | " + pad("Trans?", 8) +
        " | " + pad("Reason?", 8) +
        " | " + pad("Correct?", 8) +
        " | " + pad("Proof?", 8) +
        " | " + pad("Time (ms)", 9) + " |"
    );
    console.log(line);

    let passedCount = 0;
    for (const r of results) {
        // Overall pass condition?
        // Currently translation must pass. Reasoning/Correct/Proof are failing.
        // Let's count "Translation Passed" as partial success for this task?
        // Or keep strict: All must pass.
        const allPass = r.translationPassed !== false && r.reasonPassed && r.correctPassed && r.proofPassed;
        if (allPass) passedCount++;

        let descDisp = r.description.length > 27 ? r.description.substring(0, 27) + "..." : r.description;
        descDisp = pad(descDisp, 30);

        let suiteDisp = r.suite.length > 16 ? r.suite.substring(0, 13) + "..." : r.suite;

        const transStatus = r.translationPassed === false ? color("FAIL", "red") : (r.translationPassed === true ? color("PASS", "green") : color("N/A", "dim"));
        const reasonStatus = r.reasonPassed ? color("PASS", "green") : color("FAIL", "red");
        const correctStatus = r.correctPassed ? color("PASS", "green") : color("FAIL", "red");
        const proofStatus = r.proofPassed ? color("PASS", "green") : color("FAIL", "red");

        console.log(
            `| ${pad(suiteDisp, 16)} | ${descDisp} | ${pad(transStatus, 8)} | ${pad(reasonStatus, 8)} | ${pad(correctStatus, 8)} | ${pad(proofStatus, 8)} | ${pad(r.duration, 9)} |`
        );
    }
    console.log(line);

    const totalTime = (endTotal - startTotal).toFixed(0);
    console.log(`Total Time: ${totalTime}ms`);

    const scoreColor = passedCount === results.length ? "green" : "red";
    console.log(`Tests Passed: ${color(`${passedCount}/${results.length}`, scoreColor)}`);

    if (passedCount < results.length) {
        console.log(color("\nFAILURE: System verification failed.", "red"));
        process.exit(1);
    } else {
        console.log(color("\nSUCCESS: All systems operational.", "green"));
        process.exit(0);
    }
}

runTests().catch(console.error);
