import { promises as fs } from 'fs';
import path from 'path';

import { parseCnlToTypedAst } from '../frontend/cnl/typing.mjs';
import { parseDslToTypedAst } from '../frontend/dsl/typing.mjs';
import { Vocabulary } from '../frontend/schema/vocab.mjs';

function extractSection(md, title) {
    const marker = `## ${title}`;
    const start = md.indexOf(marker);
    if (start === -1) return '';
    const rest = md.slice(start + marker.length);
    const end = rest.indexOf('\n## ');
    return end === -1 ? rest : rest.slice(0, end);
}

function extractCases(section) {
    const cases = [];
    const regex = /###\s+(\d+)\)\s+([^\n]+)\nInput:\n```(\w+)?\n([\s\S]*?)```\n([\s\S]*?)(?=\n###|\n##|\n$)/g;
    let match = null;
    while ((match = regex.exec(section)) !== null) {
        const number = match[1];
        const title = match[2].trim();
        const lang = match[3] || '';
        const input = match[4].trim();
        const tail = match[5];
        const shapeMatch = tail.match(/Expected core AST shape:\s*\n`([^`]+)`/);
        const expectedShape = shapeMatch ? shapeMatch[1] : null;
        const codeMatch = tail.match(/`(E_[A-Z0-9_]+)`/);
        const expectedCode = codeMatch ? codeMatch[1] : null;
        cases.push({ number, title, lang, input, expectedShape, expectedCode, tail });
    }
    return cases;
}

function extractCodeBlock(md, lang) {
    const regex = new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'm');
    const match = md.match(regex);
    return match ? match[1].trim() : '';
}

function formatTerm(term) {
    if (!term) return 'null';
    if (term.kind === 'VarRef') return term.name;
    if (term.kind === 'ConstRef') return `ConstRef(${term.name}:${term.domain})`;
    if (term.kind === 'NumLit') return `NumLit(${term.value})`;
    if (term.kind === 'Func') {
        const args = term.args.map(formatTerm).join(', ');
        return `Func(${term.name},[${args}])`;
    }
    return 'Term';
}

function formatExpr(expr) {
    if (!expr) return 'null';
    switch (expr.kind) {
        case 'Pred': {
            const args = expr.args.map(formatTerm).join(', ');
            return `Pred(${expr.name},[${args}])`;
        }
        case 'And':
            return `And(${formatExpr(expr.lhs)}, ${formatExpr(expr.rhs)})`;
        case 'Or':
            return `Or(${formatExpr(expr.lhs)}, ${formatExpr(expr.rhs)})`;
        case 'Not':
            return `Not(${formatExpr(expr.expr)})`;
        case 'Implies':
            return `Implies(${formatExpr(expr.lhs)}, ${formatExpr(expr.rhs)})`;
        case 'Iff':
            return `Iff(${formatExpr(expr.lhs)}, ${formatExpr(expr.rhs)})`;
        case 'Eq':
            return `Eq(${formatTerm(expr.lhs)}, ${formatTerm(expr.rhs)})`;
        case 'ForAll':
            return `ForAll(${expr.var.name}:${expr.var.domain}, ${formatExpr(expr.body)})`;
        case 'Exists':
            return `Exists(${expr.var.name}:${expr.var.domain}, ${formatExpr(expr.body)})`;
        case 'BoolLit':
            return `BoolLit(${expr.value})`;
        default:
            return 'Expr';
    }
}

function unwrapStmt(stmt) {
    if (!stmt) return null;
    return stmt.kind === 'Assert' ? stmt.expr : stmt;
}

function cloneVocab(vocab) {
    const copy = new Vocabulary();
    for (const [name, set] of vocab.domains.entries()) {
        copy.domains.set(name, new Set(set));
    }
    for (const [name, domain] of vocab.consts.entries()) {
        copy.consts.set(name, domain);
    }
    for (const [name, sig] of vocab.predicates.entries()) {
        copy.predicates.set(name, [...sig]);
    }
    for (const [name, sig] of vocab.functions.entries()) {
        copy.functions.set(name, { args: [...sig.args], returnType: sig.returnType });
    }
    for (const [parent, children] of vocab.subtypes.entries()) {
        copy.subtypes.set(parent, new Set(children));
    }
    for (const [local, global] of vocab.aliases.entries()) {
        copy.aliases.set(local, global);
    }
    return copy;
}

function expect(condition, message) {
    if (!condition) throw new Error(message);
}

async function runCnlTests() {
    const cnlMd = await fs.readFile('docs/specs/tests/cnl-cases.md', 'utf8');
    const sharedVocabSnippet = extractCodeBlock(cnlMd, 'sys2');
    const baseVocab = parseDslToTypedAst(sharedVocabSnippet, { vocab: new Vocabulary() }).vocab;

    const acceptedSection = extractSection(cnlMd, 'Accepted Inputs');
    const rejectedSection = extractSection(cnlMd, 'Rejected Inputs');
    const accepted = extractCases(acceptedSection);
    const rejected = extractCases(rejectedSection);

    const failures = [];

    for (const testCase of accepted) {
        try {
            const vocab = cloneVocab(baseVocab);
            const result = parseCnlToTypedAst(testCase.input, vocab, { updateVocab: false });
            expect(result.statements.length > 0, `CNL case ${testCase.number} produced no statements`);
            if (testCase.expectedShape) {
                const actual = formatExpr(unwrapStmt(result.statements[0]));
                expect(actual === testCase.expectedShape, `CNL case ${testCase.number} shape mismatch: ${actual}`);
            }
        } catch (err) {
            failures.push(`CNL case ${testCase.number} failed: ${err.message}`);
        }
    }

    for (const testCase of rejected) {
        try {
            const vocab = cloneVocab(baseVocab);
            parseCnlToTypedAst(testCase.input, vocab, { updateVocab: false });
            failures.push(`CNL reject case ${testCase.number} did not fail`);
        } catch (err) {
            if (testCase.expectedCode && err.code !== testCase.expectedCode) {
                failures.push(`CNL reject case ${testCase.number} expected ${testCase.expectedCode}, got ${err.code || 'none'}`);
            }
        }
    }

    return failures;
}

async function runDslTests() {
    const cnlMd = await fs.readFile('docs/specs/tests/cnl-cases.md', 'utf8');
    const sharedVocabSnippet = extractCodeBlock(cnlMd, 'sys2');
    const sharedVocab = parseDslToTypedAst(sharedVocabSnippet, { vocab: new Vocabulary() }).vocab;
    sharedVocab.addPred('Active', ['Cell']);
    sharedVocab.addPred('IsSick', ['Person']);
    sharedVocab.addAlias('Trusts', 'trusts');

    const dslMd = await fs.readFile('docs/specs/tests/dsl-cases.md', 'utf8');
    const acceptedSection = extractSection(dslMd, 'Accepted Inputs');
    const rejectedSection = extractSection(dslMd, 'Rejected Inputs');
    const accepted = extractCases(acceptedSection);
    const rejected = extractCases(rejectedSection);
    const specialAccept = new Set(['6', '8', '9', '10']);
    const acceptedAll = accepted.concat(rejected.filter((c) => specialAccept.has(c.number)));
    const rejectedAll = rejected.filter((c) => !specialAccept.has(c.number));

    const failures = [];

    for (const testCase of acceptedAll) {
        try {
            let vocab = cloneVocab(sharedVocab);
            let result = null;

            if (testCase.number === '1') {
                vocab = new Vocabulary();
                result = parseDslToTypedAst(testCase.input, { vocab });
                expect(result.vocab.getConstDomain('c2') === 'Cell', 'c2 should be typed as Cell');
                continue;
            }

            if (testCase.number === '6') {
                const root = path.join('evals', 'tmp-dsl-tests');
                const sharedDir = path.join(root, 'shared');
                const caseDir = path.join(root, 'cases');
                await fs.mkdir(sharedDir, { recursive: true });
                await fs.mkdir(caseDir, { recursive: true });
                const vocabPath = path.join(sharedDir, 'vocab.sys2');
                const casePath = path.join(caseDir, 'test1.sys2');
                const vocabContent = [
                    'Vocab',
                    '    Domain Person',
                    '    Const Alice Person',
                    '    Pred HasFever Person',
                    'end',
                    ''
                ].join('\n');
                await fs.writeFile(vocabPath, vocabContent, 'utf8');
                await fs.writeFile(casePath, testCase.input, 'utf8');
                const fileContent = await fs.readFile(casePath, 'utf8');
                result = parseDslToTypedAst(fileContent, {
                    vocab: new Vocabulary(),
                    baseDir: caseDir,
                    loadFiles: true
                });
                expect(result.vocab.getPredSignature('HasFever'), 'Loaded vocab should include HasFever');
                continue;
            }

            if (testCase.number === '11') {
                vocab = new Vocabulary();
                vocab.addDomain('Entity');
                vocab.addPred('Trusts', ['Entity', 'Entity']);
                result = parseDslToTypedAst(testCase.input, {
                    vocab,
                    implicitDomain: 'Entity'
                });
                const expr = unwrapStmt(result.statements[0]);
                expect(expr?.kind === 'Pred' && expr.args[0].name === 'Alice', 'Alias should resolve to Alice');
                continue;
            }

            result = parseDslToTypedAst(testCase.input, { vocab });
            const expr = unwrapStmt(result.statements[0]);

            if (testCase.expectedShape) {
                const actual = formatExpr(expr);
                expect(actual === testCase.expectedShape, `DSL case ${testCase.number} shape mismatch: ${actual}`);
            }

            if (testCase.number === '2') {
                expect(expr?.kind === 'Pred' && expr.name === 'proteinP', 'Expected proteinP predicate');
            }

            if (testCase.number === '3') {
                expect(expr?.kind === 'Pred' && expr.name === 'trusts', 'Expected trusts predicate');
            }

            if (testCase.number === '5') {
                expect(expr?.kind === 'Exists', 'Expected Exists expression');
                expect(expr.var.name === 'p' && expr.var.domain === 'Person', 'Expected witness p:Person');
            }

            if (testCase.number === '8') {
                expect(result.vocab.isSubtype('Patient', 'Person'), 'Subtype Patient <: Person expected');
            }

            if (testCase.number === '9') {
                expect(expr?.kind === 'Pred' && expr.args[0].name === 'c0', 'Alias myCell should resolve to c0');
            }

            if (testCase.number === '10') {
                expect(result.vocab.isSubtype('Doctor', 'Entity'), 'Subtype transitivity Doctor <: Entity expected');
            }
        } catch (err) {
            failures.push(`DSL case ${testCase.number} failed: ${err.message}`);
        }
    }

    for (const testCase of rejectedAll) {
        try {
            const vocab = cloneVocab(sharedVocab);
            parseDslToTypedAst(testCase.input, { vocab, loadFiles: true });
            failures.push(`DSL reject case ${testCase.number} did not fail`);
        } catch (err) {
            if (testCase.expectedCode && err.code !== testCase.expectedCode) {
                failures.push(`DSL reject case ${testCase.number} expected ${testCase.expectedCode}, got ${err.code || 'none'}`);
            }
        }
    }

    return failures;
}

async function main() {
    const failures = [];
    failures.push(...await runCnlTests());
    failures.push(...await runDslTests());

    if (failures.length > 0) {
        console.error('Typed AST tests failed:');
        for (const msg of failures) console.error(`- ${msg}`);
        process.exit(1);
    }

    console.log('Typed AST tests passed.');
}

main().catch((err) => {
    console.error('Typed AST tests fatal:', err.message);
    process.exit(1);
});
