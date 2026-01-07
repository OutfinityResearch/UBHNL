import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fastEvalDir = path.join(__dirname, 'fastEval');

// --- COLORS ---
const C = {
    reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m", 
    yellow: "\x1b[33m", blue: "\x1b[34m", cyan: "\x1b[36m", 
    dim: "\x1b[2m", bold: "\x1b[1m"
};

function color(text, col) { return (C[col] || "") + text + C.reset; }

function pad(str, len) {
    str = String(str);
    const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
    return visibleLen >= len ? str : str + " ".repeat(len - visibleLen);
}

// Mock session - kernel not implemented yet
class MockSession {
    async query(input, kind) {
        return { status: 'NOT_IMPL', answer: null, proof: null };
    }
}

async function runTests() {
    console.log(color("UBHNL FastEval Suite", "bold") + color(" (Strict Verification Mode)\n", "dim"));

    const suites = await fs.readdir(fastEvalDir, { withFileTypes: true });
    const results = [];
    const startTotal = performance.now();

    for (const dirent of suites.filter(d => d.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
        const suiteDir = path.join(fastEvalDir, dirent.name);
        const testDefPath = path.join(suiteDir, 'test.desc');
        
        if (!await fs.stat(testDefPath).catch(() => false)) continue;

        const testDef = JSON.parse(await fs.readFile(testDefPath, 'utf-8'));
        const suiteName = dirent.name;
        const session = new MockSession();

        // Load source.cnl for display
        let sourcePreview = '';
        try {
            const src = await fs.readFile(path.join(suiteDir, 'source.cnl'), 'utf-8');
            const lines = src.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('//'));
            sourcePreview = lines.slice(0, 2).map(l => l.trim()).join(' | ').slice(0, 60);
        } catch {}

        // Load proof.cnl
        let proofContent = null;
        try {
            proofContent = (await fs.readFile(path.join(suiteDir, 'proof.cnl'), 'utf-8')).trim();
        } catch {}

        // --- TRANSLATION TEST ---
        let translationOk = true;
        let translationDiff = null;

        try {
            const cnlPath = path.join(suiteDir, 'source.cnl');
            const sys2Path = path.join(suiteDir, 'expected.sys2');
            
            const [hasCnl, hasSys2] = await Promise.all([
                fs.stat(cnlPath).catch(() => false),
                fs.stat(sys2Path).catch(() => false)
            ]);

            if (hasCnl && hasSys2) {
                const [cnlContent, expectedSys2] = await Promise.all([
                    fs.readFile(cnlPath, 'utf-8'),
                    fs.readFile(sys2Path, 'utf-8')
                ]);

                const { translate } = await import('../src/cnlTranslator/index.mjs');
                const generated = translate(cnlContent);

                const norm = s => s.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).join('\n');
                const normGen = norm(generated);
                const normExp = norm(expectedSys2);

                if (normGen !== normExp) {
                    translationOk = false;
                    const genLines = normGen.split('\n');
                    const expLines = normExp.split('\n');
                    for (let i = 0; i < Math.max(genLines.length, expLines.length); i++) {
                        if (genLines[i] !== expLines[i]) {
                            translationDiff = { line: i+1, exp: expLines[i] || '∅', got: genLines[i] || '∅' };
                            break;
                        }
                    }
                }
            }
        } catch (err) {
            translationOk = false;
            translationDiff = { error: err.message };
        }

        // Print suite header - COMPACT ONE LINE
        const transIcon = translationOk ? color('✓', 'green') : color('✗', 'red');
        console.log(`${color(suiteName, 'blue')} ${transIcon} ${color(sourcePreview, 'dim')}`);

        // Show diff if translation failed
        if (!translationOk && translationDiff) {
            if (translationDiff.error) {
                console.log(color(`  └─ Error: ${translationDiff.error}`, 'red'));
            } else {
                console.log(color(`  └─ L${translationDiff.line}: `, 'dim') + 
                    color(`exp="${translationDiff.exp}"`, 'green') + ' ' +
                    color(`got="${translationDiff.got}"`, 'red'));
            }
        }

        // --- RUN EACH TEST CASE ---
        for (const testCase of testDef) {
            const startTest = performance.now();
            const result = await session.query(testCase.input, testCase.kind);
            const duration = (performance.now() - startTest).toFixed(2);

            const reasonOk = result.status === 'OK';
            const correctOk = result.answer === testCase.expected;
            const proofOk = proofContent && result.proof && result.proof.trim() === proofContent;

            results.push({
                suite: suiteName,
                desc: testCase.description || testCase.input,
                input: testCase.input,
                expected: testCase.expected,
                transOk: translationOk,
                reasonOk, correctOk, proofOk,
                duration
            });

            // Show test case result - COMPACT
            const desc = (testCase.description || testCase.input).slice(0, 35);
            const rIcon = reasonOk ? color('✓', 'green') : color('·', 'dim');
            const cIcon = correctOk ? color('✓', 'green') : color('·', 'dim');
            const pIcon = proofOk ? color('✓', 'green') : color('·', 'dim');
            
            // Only show details if something interesting happened
            if (!reasonOk && !correctOk && !proofOk) {
                // All pending - show compact
                console.log(color(`  → ${desc}`, 'dim') + color(` [R${rIcon} C${cIcon} P${pIcon}]`, 'dim'));
            } else {
                console.log(`  → ${desc} [R${rIcon} C${cIcon} P${pIcon}]`);
            }
        }
    }

    const totalTime = (performance.now() - startTotal).toFixed(0);

    // --- FINAL TABLE ---
    console.log("\n" + color("═".repeat(100), "dim"));
    console.log(color("Summary Table", "cyan") + color(" (Trans=Translation, R=Reasoning, C=Correct, P=Proof)", "dim"));
    console.log(color("─".repeat(100), "dim"));
    console.log(
        "| " + pad("Suite", 22) +
        " | " + pad("Test", 32) +
        " | " + pad("Trans", 5) +
        " | " + pad("R", 4) +
        " | " + pad("C", 4) +
        " | " + pad("P", 4) +
        " | " + pad("ms", 6) + " |"
    );
    console.log(color("─".repeat(100), "dim"));

    let passCount = 0;
    for (const r of results) {
        const allPass = r.transOk && r.reasonOk && r.correctOk && r.proofOk;
        if (allPass) passCount++;

        const suite = r.suite.length > 22 ? r.suite.slice(0, 19) + '...' : r.suite;
        const desc = r.desc.length > 32 ? r.desc.slice(0, 29) + '...' : r.desc;

        const t = r.transOk ? color("✓", "green") : color("✗", "red");
        const re = r.reasonOk ? color("✓", "green") : color("·", "dim");
        const c = r.correctOk ? color("✓", "green") : color("·", "dim");
        const p = r.proofOk ? color("✓", "green") : color("·", "dim");

        console.log(
            `| ${pad(suite, 22)} | ${pad(desc, 32)} | ${pad(t, 5)} | ${pad(re, 4)} | ${pad(c, 4)} | ${pad(p, 4)} | ${pad(r.duration, 6)} |`
        );
    }

    console.log(color("─".repeat(100), "dim"));
    
    const transPass = results.filter(r => r.transOk).length;
    console.log(`Translations: ${transPass}/${results.length} passed`);
    console.log(`Reasoning: ${color("NOT IMPLEMENTED", "yellow")} (kernel pending)`);
    console.log(`Total Time: ${totalTime}ms`);

    const scoreColor = passCount === results.length ? "green" : (transPass === results.length ? "yellow" : "red");
    console.log(`\nOverall: ${color(`${passCount}/${results.length}`, scoreColor)} fully passed`);

    if (transPass < results.length) {
        console.log(color("\n⚠ Translation failures detected", "red"));
        process.exit(1);
    } else if (passCount < results.length) {
        console.log(color("\n◐ Translations OK, reasoning pending", "yellow"));
        process.exit(0);
    } else {
        console.log(color("\n✓ All systems operational", "green"));
        process.exit(0);
    }
}

runTests().catch(console.error);
