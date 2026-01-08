import {
    assertStmt,
    pred,
    andExpr,
    orExpr,
    notExpr,
    impliesExpr,
    iffExpr,
    forAll,
    exists,
    varRef,
    constRef,
    boolLit
} from '../logic/ast.mjs';

function stripComments(line) {
    const hash = line.indexOf('#');
    const slash = line.indexOf('//');
    let end = line.length;
    if (hash !== -1) end = Math.min(end, hash);
    if (slash !== -1) end = Math.min(end, slash);
    return line.slice(0, end);
}

function countIndent(line) {
    let count = 0;
    for (const ch of line) {
        if (ch === ' ') count += 1;
        else if (ch === '\t') count += 4;
        else break;
    }
    return count;
}

function splitLine(line) {
    const trimmed = stripComments(line).replace(/\s+$/u, '');
    return { indent: countIndent(trimmed), text: trimmed.trim() };
}

function capitalize(word) {
    return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

function isNumericLiteral(text) {
    return /^\d+(\/\d+)?$/.test(text) || /^\d*\.\d+$/.test(text);
}

function normalizePlural(type) {
    if (type.endsWith('ies')) return type.slice(0, -3) + 'y';
    if (type.endsWith('s')) return type.slice(0, -1);
    return type;
}

function findBoundVar(boundVars, name) {
    for (let i = boundVars.length - 1; i >= 0; i--) {
        const domain = boundVars[i].get(name);
        if (domain) return domain;
    }
    return null;
}

function ensureDomain(vocab, name) {
    if (!vocab.domains.has(name)) vocab.addDomain(name);
}

function resolveTerm(token, vocab, options, boundVars, freeVars) {
    if (token.startsWith('$')) {
        const name = token.slice(1);
        const domain = findBoundVar(boundVars, name);
        if (domain) return varRef(name, domain);
        if (!freeVars.includes(name)) freeVars.push(name);
        ensureDomain(vocab, options.implicitDomain);
        return varRef(name, options.implicitDomain);
    }

    if (isNumericLiteral(token)) {
        const domain = options.numericDomain;
        ensureDomain(vocab, domain);
        return { kind: 'NumLit', value: token, domain };
    }

    const constDomain = vocab.getConstDomain(token);
    if (!constDomain) {
        throw new Error(`Unknown constant: ${token}`);
    }
    return constRef(token, constDomain);
}

function parseArgsList(argStr) {
    const args = [];
    let depth = 0;
    let current = '';
    for (const ch of argStr) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    if (current.trim()) args.push(current.trim());
    return args;
}

function termDomain(term, vocab) {
    if (!term) return null;
    if (term.kind === 'VarRef' || term.kind === 'ConstRef') return term.domain;
    if (term.kind === 'NumLit') return term.domain;
    if (term.kind === 'Func') {
        const sig = vocab.getFuncSignature(term.name);
        return sig ? sig.returnType : null;
    }
    return null;
}

function validateFuncTerm(term, vocab) {
    const sig = vocab.getFuncSignature(term.name);
    if (!sig) throw new Error(`Unknown function: ${term.name}`);
    if (sig.args.length !== term.args.length) {
        throw new Error(`Arity mismatch for function ${term.name}: expected ${sig.args.length}, got ${term.args.length}`);
    }
    for (let i = 0; i < sig.args.length; i++) {
        const arg = term.args[i];
        const actual = termDomain(arg, vocab);
        if (!actual || !vocab.isCompatible(actual, sig.args[i])) {
            throw new Error(`Type mismatch for function ${term.name} arg ${i}: expected ${sig.args[i]}, got ${actual}`);
        }
    }
}

function validatePredicate(name, args, vocab) {
    const sig = vocab.getPredSignature(name);
    if (!sig) throw new Error(`Unknown predicate: ${name}`);
    if (sig.length !== args.length) {
        throw new Error(`Arity mismatch for ${name}: expected ${sig.length}, got ${args.length}`);
    }
    for (let i = 0; i < sig.length; i++) {
        const arg = args[i];
        if (arg?.kind === 'Func') validateFuncTerm(arg, vocab);
        const actual = termDomain(arg, vocab);
        if (!actual || !vocab.isCompatible(actual, sig[i])) {
            throw new Error(`Type mismatch for ${name} arg ${i}: expected ${sig[i]}, got ${actual}`);
        }
    }
}

function resolveHasPredicate(subject, propToken, vocab) {
    const derived = `Has${capitalize(propToken)}`;
    const hasSig = vocab.getPredSignature('Has');
    if (vocab.getPredSignature(derived)) {
        return pred(derived, [subject]);
    }
    if (hasSig && hasSig.length === 2 && vocab.hasConst(propToken)) {
        return pred('Has', [subject, constRef(propToken, vocab.getConstDomain(propToken))]);
    }
    throw new Error(`Unknown has-pattern predicate for property: ${propToken}`);
}

function parsePredicateCall(text, vocab, options, boundVars, freeVars) {
    const match = text.match(/^(\w+)\((.+)\)$/);
    if (!match) return null;
    const name = match[1];
    const sig = vocab.getPredSignature(name);
    if (!sig) throw new Error(`Unknown predicate: ${name}`);
    const args = parseArgsList(match[2]).map((arg) => parseTerm(arg, vocab, options, boundVars, freeVars));
    validatePredicate(name, args, vocab);
    return pred(name, args);
}

function parseTerm(text, vocab, options, boundVars, freeVars) {
    const trimmed = text.trim();
    const funcMatch = trimmed.match(/^(\w+)\((.+)\)$/);
    if (funcMatch) {
        const name = funcMatch[1];
        const sig = vocab.getFuncSignature(name);
        if (!sig) throw new Error(`Unknown function: ${name}`);
        const args = parseArgsList(funcMatch[2]).map((arg) => parseTerm(arg, vocab, options, boundVars, freeVars));
        const term = { kind: 'Func', name, args };
        validateFuncTerm(term, vocab);
        return term;
    }
    return resolveTerm(trimmed, vocab, options, boundVars, freeVars);
}

function parseExpr(text, vocab, options, boundVars, freeVars) {
    let src = text.trim();
    if (src.endsWith('.')) src = src.slice(0, -1).trim();

    if (src.toLowerCase().startsWith('it is not the case that')) {
        const inner = src.slice('it is not the case that'.length).trim();
        return notExpr(parseExpr(inner, vocab, options, boundVars, freeVars));
    }

    if (src.includes(' if and only if ')) {
        const parts = src.split(' if and only if ');
        if (parts.length === 2) {
            return iffExpr(
                parseExpr(parts[0], vocab, options, boundVars, freeVars),
                parseExpr(parts[1], vocab, options, boundVars, freeVars)
            );
        }
    }

    if (src.includes(' iff ')) {
        const parts = src.split(' iff ');
        if (parts.length === 2) {
            return iffExpr(
                parseExpr(parts[0], vocab, options, boundVars, freeVars),
                parseExpr(parts[1], vocab, options, boundVars, freeVars)
            );
        }
    }

    if (src.startsWith('not ')) {
        const inner = src.slice(4);
        return notExpr(parseExpr(inner, vocab, options, boundVars, freeVars));
    }

    if (src.includes(' or ')) {
        const parts = src.split(' or ').map((part) => parseExpr(part, vocab, options, boundVars, freeVars));
        return parts.reduce((acc, next) => (acc ? orExpr(acc, next) : next), null);
    }

    if (src.includes(' and ')) {
        const parts = src.split(' and ').map((part) => parseExpr(part, vocab, options, boundVars, freeVars));
        return parts.reduce((acc, next) => (acc ? andExpr(acc, next) : next), null);
    }

    const predFallback = parsePredicateCall(src, vocab, options, boundVars, freeVars);
    if (predFallback) return predFallback;

    const notVerbMatch = src.match(/^(.+)\s+does\s+not\s+(\w+)(?:\s+(.+))?$/i);
    if (notVerbMatch) {
        const subject = parseTerm(notVerbMatch[1], vocab, options, boundVars, freeVars);
        const verb = capitalize(notVerbMatch[2]);
        if (notVerbMatch[3]) {
            const obj = parseTerm(notVerbMatch[3], vocab, options, boundVars, freeVars);
            const expr = pred(verb, [subject, obj]);
            validatePredicate(verb, expr.args, vocab);
            return notExpr(expr);
        }
        const expr = pred(verb, [subject]);
        validatePredicate(verb, expr.args, vocab);
        return notExpr(expr);
    }

    const notAdjMatch = src.match(/^(.+)\s+is\s+not\s+(\w+)$/i);
    if (notAdjMatch) {
        const subject = parseTerm(notAdjMatch[1], vocab, options, boundVars, freeVars);
        const adj = notAdjMatch[2];
        const expr = pred(adj, [subject]);
        validatePredicate(adj, expr.args, vocab);
        return notExpr(expr);
    }

    const relMatch = src.match(/^(.+)\s+is\s+(\w+)\s+of\s+(.+)$/i);
    if (relMatch) {
        const subject = parseTerm(relMatch[1], vocab, options, boundVars, freeVars);
        const rel = relMatch[2];
        const obj = parseTerm(relMatch[3], vocab, options, boundVars, freeVars);
        const expr = pred(rel, [subject, obj]);
        validatePredicate(rel, expr.args, vocab);
        return expr;
    }

    const hasMatch = src.match(/^(.+)\s+has\s+(\w+)$/i);
    if (hasMatch) {
        const subject = parseTerm(hasMatch[1], vocab, options, boundVars, freeVars);
        const prop = hasMatch[2];
        const expr = resolveHasPredicate(subject, prop, vocab);
        validatePredicate(expr.name, expr.args, vocab);
        return expr;
    }

    const adjMatch = src.match(/^(.+)\s+is\s+(\w+)$/i);
    if (adjMatch) {
        const subject = parseTerm(adjMatch[1], vocab, options, boundVars, freeVars);
        const adj = adjMatch[2];
        const expr = pred(adj, [subject]);
        validatePredicate(adj, expr.args, vocab);
        return expr;
    }

    const svoMatch = src.match(/^(.+)\s+(\w+)\s+(.+)$/i);
    if (svoMatch) {
        const subject = parseTerm(svoMatch[1], vocab, options, boundVars, freeVars);
        const verb = capitalize(svoMatch[2]);
        const obj = parseTerm(svoMatch[3], vocab, options, boundVars, freeVars);
        const expr = pred(verb, [subject, obj]);
        validatePredicate(verb, expr.args, vocab);
        return expr;
    }

    if (src === 'true' || src === 'false') return boolLit(src === 'true');

    throw new Error(`Unable to parse expression: ${src}`);
}

function wrapWithQuantifiers(expr, quantifiers) {
    let wrapped = expr;
    for (let i = quantifiers.length - 1; i >= 0; i--) {
        const q = quantifiers[i];
        wrapped = q.kind === 'Exists'
            ? exists(q.varName, q.domain, wrapped)
            : forAll(q.varName, q.domain, wrapped);
    }
    return wrapped;
}

function parseQuantifierLine(text) {
    const forMatch = text.match(/^For\s+(all|any|every|each)\s+(\w+)\s+(\w+)\s*:\s*$/i);
    if (forMatch) {
        return { kind: 'ForAll', domain: forMatch[2], varName: forMatch[3] };
    }
    const eachMatch = text.match(/^(Each|Every)\s+(\w+)\s+(\w+)\s*:\s*$/i);
    if (eachMatch) {
        return { kind: 'ForAll', domain: eachMatch[2], varName: eachMatch[3] };
    }
    const existsMatch = text.match(/^(There\s+exists|Exists)\s+(?:an?\s+)?(\w+)\s+(\w+)\s*:\s*$/i);
    if (existsMatch) {
        return { kind: 'Exists', domain: existsMatch[2], varName: existsMatch[3] };
    }
    return null;
}

function parseStatements(lines, startIndex, baseIndent, vocab, options, boundVars) {
    const statements = [];
    let idx = startIndex;

    while (idx < lines.length) {
        const { indent, text } = splitLine(lines[idx]);
        if (!text) {
            idx++;
            continue;
        }
        if (indent < baseIndent) break;
        if (indent > baseIndent) {
            throw new Error(`Unexpected indentation at line ${idx + 1}`);
        }

        const quant = parseQuantifierLine(text);
        if (quant) {
            if (!vocab.domains.has(quant.domain)) {
                if (options.updateVocab) vocab.addDomain(quant.domain);
                else throw new Error(`Unknown domain: ${quant.domain}`);
            }
            const newScope = new Map();
            newScope.set(quant.varName, quant.domain);
            boundVars.push(newScope);
            const inner = parseStatements(lines, idx + 1, baseIndent + 4, vocab, options, boundVars);
            boundVars.pop();
            for (const stmt of inner.statements) {
                const wrapped = wrapWithQuantifiers(stmt.expr, [quant]);
                statements.push(assertStmt(wrapped));
            }
            idx = inner.nextIndex;
            continue;
        }

        if (text.startsWith('If ')) {
            const ifMatch = text.match(/^If\s+(.+)\s+then\s+(.+)\.?$/i);
            if (!ifMatch) throw new Error(`Malformed If statement at line ${idx + 1}`);
            const freeVars = [];
            const left = parseExpr(ifMatch[1], vocab, options, boundVars, freeVars);
            const right = parseExpr(ifMatch[2], vocab, options, boundVars, freeVars);
            let expr = impliesExpr(left, right);
            if (freeVars.length > 0) {
                const quantifiers = freeVars.map((name) => ({
                    kind: 'ForAll',
                    varName: name,
                    domain: options.implicitDomain
                }));
                expr = wrapWithQuantifiers(expr, quantifiers);
            }
            statements.push(assertStmt(expr));
            idx++;
            continue;
        }

        const freeVars = [];
        const expr = parseExpr(text, vocab, options, boundVars, freeVars);
        let wrapped = expr;
        if (freeVars.length > 0) {
            const quantifiers = freeVars.map((name) => ({
                kind: 'ForAll',
                varName: name,
                domain: options.implicitDomain
            }));
            wrapped = wrapWithQuantifiers(expr, quantifiers);
        }
        statements.push(assertStmt(wrapped));
        idx++;
    }

    return { statements, nextIndex: idx };
}

function parseDeclarations(lines, vocab, options) {
    for (const line of lines) {
        const { text } = splitLine(line);
        if (!text) continue;
        if (text.startsWith('load ')) continue;

        let dm = text.match(/^Let\s+(\w+)\s+be\s+a\s+Domain\.$/i);
        if (dm) {
            if (options.updateVocab) vocab.addDomain(dm[1]);
            continue;
        }
        dm = text.match(/^(\w+)\s+is\s+a\s+Domain\.$/i);
        if (dm) {
            if (options.updateVocab) vocab.addDomain(dm[1]);
            continue;
        }

        let am = text.match(/^Let\s+(\w+)\s+be\s+a\s+(\w+)\.$/i);
        if (am && am[2] !== 'Domain') {
            if (options.updateVocab) {
                const type = normalizePlural(am[2]);
                ensureDomain(vocab, type);
                vocab.addConst(am[1], type);
            }
            continue;
        }
        am = text.match(/^(\w+)\s+is\s+a\s+(\w+)\.$/i);
        if (am && am[2] !== 'Domain') {
            if (options.updateVocab) {
                const type = normalizePlural(am[2]);
                ensureDomain(vocab, type);
                vocab.addConst(am[1], type);
            }
            continue;
        }

        const multi = text.match(/^Let\s+(.+)\s+be\s+(\w+)\.$/i);
        if (multi && options.updateVocab) {
            const names = multi[1].split(',').map((n) => n.trim()).filter(Boolean);
            const type = normalizePlural(multi[2]);
            ensureDomain(vocab, type);
            for (const name of names) vocab.addConst(name, type);
        }
    }
}

export function parseCnlToTypedAst(cnlSource, vocab, options = {}) {
    if (!vocab) throw new Error('parseCnlToTypedAst requires a vocabulary');
    const cfg = {
        implicitDomain: options.implicitDomain || 'Entity',
        numericDomain: options.numericDomain || 'Int',
        updateVocab: options.updateVocab !== false
    };

    const lines = cnlSource.split(/\r?\n/u);
    parseDeclarations(lines, vocab, cfg);

    const boundVars = [];
    const { statements } = parseStatements(lines, 0, 0, vocab, cfg, boundVars);
    return { vocab, statements };
}
