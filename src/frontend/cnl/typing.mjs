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

function makeError(message, code) {
    const err = new Error(message);
    if (code) err.code = code;
    return err;
}

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

function stripVarToken(token) {
    return token.startsWith('$') ? token.slice(1) : token;
}

function isDeclarationLine(text) {
    if (text.startsWith('load ')) return true;
    if (text.match(/^Let\s+(\w+)\s+be\s+a\s+Domain\.$/i)) return true;
    if (text.match(/^(\w+)\s+is\s+a\s+Domain\.$/i)) return true;
    if (text.match(/^Let\s+(\w+)\s+be\s+a\s+(\w+)\.$/i)) return true;
    if (text.match(/^(\w+)\s+is\s+a\s+(\w+)\.$/i)) return true;
    if (text.match(/^Let\s+(.+)\s+be\s+(\w+)\.$/i)) return true;
    return false;
}

function normalizePhraseVariants(phrase) {
    const tokens = phrase
        .split(/[\s-]+/u)
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => token.toLowerCase());
    const camel = tokens
        .map((token, idx) => (idx === 0 ? token : capitalize(token)))
        .join('');
    const snake = tokens.join('_');
    return { camel, snake };
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

    const constName = vocab.resolveConstName(token);
    if (!constName) {
        throw makeError(`Unknown constant: ${token}`, 'E_UNKNOWN_SYMBOL');
    }
    return constRef(constName, vocab.getConstDomain(constName));
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
    if (!sig) throw makeError(`Unknown function: ${term.name}`, 'E_UNKNOWN_PREDICATE');
    if (sig.args.length !== term.args.length) {
        throw makeError(`Arity mismatch for function ${term.name}: expected ${sig.args.length}, got ${term.args.length}`, 'E_ARITY_MISMATCH');
    }
    for (let i = 0; i < sig.args.length; i++) {
        const arg = term.args[i];
        const actual = termDomain(arg, vocab);
        if (!actual || !vocab.isCompatible(actual, sig.args[i])) {
            throw makeError(`Type mismatch for function ${term.name} arg ${i}: expected ${sig.args[i]}, got ${actual}`, 'E_TYPE_MISMATCH');
        }
    }
}

function validatePredicate(name, args, vocab) {
    const sig = vocab.getPredSignature(name);
    if (!sig) throw makeError(`Unknown predicate: ${name}`, 'E_UNKNOWN_PREDICATE');
    if (sig.length !== args.length) {
        throw makeError(`Arity mismatch for ${name}: expected ${sig.length}, got ${args.length}`, 'E_ARITY_MISMATCH');
    }
    for (let i = 0; i < sig.length; i++) {
        const arg = args[i];
        if (arg?.kind === 'Func') validateFuncTerm(arg, vocab);
        const actual = termDomain(arg, vocab);
        if (!actual || !vocab.isCompatible(actual, sig[i])) {
            throw makeError(`Type mismatch for ${name} arg ${i}: expected ${sig[i]}, got ${actual}`, 'E_TYPE_MISMATCH');
        }
    }
}

function resolvePredicateName(candidates, vocab) {
    for (const candidate of candidates) {
        const resolved = vocab.resolvePredName(candidate);
        if (resolved) return resolved;
    }
    return null;
}

function resolveHasPredicate(subject, propPhrase, vocab) {
    let prop = propPhrase.trim();
    if (prop.startsWith('(') && prop.endsWith(')')) {
        prop = prop.slice(1, -1).trim();
    }
    const { camel, snake } = normalizePhraseVariants(prop);
    const derived = `Has${capitalize(camel)}`;
    const derivedAlt = `Has${capitalize(snake)}`;
    const hasName = resolvePredicateName(['Has'], vocab);

    const direct = resolvePredicateName([derived, derivedAlt], vocab);
    if (direct) return pred(direct, [subject]);

    if (hasName) {
        const constName = vocab.resolveConstName(prop)
            || vocab.resolveConstName(camel)
            || vocab.resolveConstName(snake);
        if (constName) {
            return pred(hasName, [subject, constRef(constName, vocab.getConstDomain(constName))]);
        }
    }

    const propPred = resolvePredicateName([camel, snake], vocab);
    if (propPred) return pred(propPred, [subject]);

    const hasPhrase = resolvePredicateName([`has${capitalize(camel)}`, `has_${snake}`], vocab);
    if (hasPhrase) return pred(hasPhrase, [subject]);

    throw makeError(`Unknown has-pattern predicate for property: ${prop}`, 'E_CNL_UNKNOWN_ALIAS');
}

function parsePredicateCall(text, vocab, options, boundVars, freeVars) {
    const match = text.match(/^(\w+)\((.+)\)$/);
    if (!match) return null;
    const name = match[1];
    const resolved = vocab.resolvePredName(name);
    if (!resolved) throw makeError(`Unknown predicate: ${name}`, 'E_UNKNOWN_PREDICATE');
    const sig = vocab.getPredSignature(resolved);
    const args = parseArgsList(match[2]).map((arg) => parseTerm(arg, vocab, options, boundVars, freeVars));
    validatePredicate(resolved, args, vocab);
    return pred(resolved, args);
}

function parseTerm(text, vocab, options, boundVars, freeVars) {
    const trimmed = text.trim();
    const funcMatch = trimmed.match(/^(\w+)\((.+)\)$/);
    if (funcMatch) {
        const name = funcMatch[1];
        const resolved = vocab.resolveFuncName(name);
        if (!resolved) throw makeError(`Unknown function: ${name}`, 'E_UNKNOWN_PREDICATE');
        const sig = vocab.getFuncSignature(resolved);
        const args = parseArgsList(funcMatch[2]).map((arg) => parseTerm(arg, vocab, options, boundVars, freeVars));
        const term = { kind: 'Func', name: resolved, args };
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

    if (/\)\s+\w+\(/.test(src)) {
        throw makeError(`Missing connector in expression: ${src}`, 'E_CNL_MISSING_CONNECTOR');
    }

    const predFallback = parsePredicateCall(src, vocab, options, boundVars, freeVars);
    if (predFallback) return predFallback;

    const notHasMatch = src.match(/^(.+)\s+does\s+not\s+have\s+(.+)$/i);
    if (notHasMatch) {
        const subject = parseTerm(notHasMatch[1], vocab, options, boundVars, freeVars);
        const prop = notHasMatch[2];
        const expr = resolveHasPredicate(subject, prop, vocab);
        validatePredicate(expr.name, expr.args, vocab);
        return notExpr(expr);
    }

    const notVerbMatch = src.match(/^(.+)\s+does\s+not\s+(\w+)(?:\s+(.+))?$/i);
    if (notVerbMatch) {
        const subject = parseTerm(notVerbMatch[1], vocab, options, boundVars, freeVars);
        const verb = notVerbMatch[2];
        const resolvedVerb = resolvePredicateName([verb, verb.toLowerCase(), capitalize(verb)], vocab);
        if (!resolvedVerb) throw makeError(`Unknown predicate: ${verb}`, 'E_UNKNOWN_PREDICATE');
        if (notVerbMatch[3]) {
            const obj = parseTerm(notVerbMatch[3], vocab, options, boundVars, freeVars);
            const expr = pred(resolvedVerb, [subject, obj]);
            validatePredicate(resolvedVerb, expr.args, vocab);
            return notExpr(expr);
        }
        const expr = pred(resolvedVerb, [subject]);
        validatePredicate(resolvedVerb, expr.args, vocab);
        return notExpr(expr);
    }

    const notAdjMatch = src.match(/^(.+)\s+is\s+not\s+(\w+)$/i);
    if (notAdjMatch) {
        const subject = parseTerm(notAdjMatch[1], vocab, options, boundVars, freeVars);
        const adj = notAdjMatch[2];
        const resolvedAdj = resolvePredicateName(
            [adj, adj.toLowerCase(), capitalize(adj), `Is${capitalize(adj)}`],
            vocab
        );
        if (!resolvedAdj) throw makeError(`Unknown predicate: ${adj}`, 'E_UNKNOWN_PREDICATE');
        const expr = pred(resolvedAdj, [subject]);
        validatePredicate(resolvedAdj, expr.args, vocab);
        return notExpr(expr);
    }

    const relMatch = src.match(/^(.+)\s+is\s+(\w+)\s+of\s+(.+)$/i);
    if (relMatch) {
        const subject = parseTerm(relMatch[1], vocab, options, boundVars, freeVars);
        const rel = relMatch[2];
        const resolvedRel = resolvePredicateName([rel, rel.toLowerCase(), capitalize(rel)], vocab);
        if (!resolvedRel) throw makeError(`Unknown predicate: ${rel}`, 'E_UNKNOWN_PREDICATE');
        const obj = parseTerm(relMatch[3], vocab, options, boundVars, freeVars);
        const expr = pred(resolvedRel, [subject, obj]);
        validatePredicate(resolvedRel, expr.args, vocab);
        return expr;
    }

    const hasMatch = src.match(/^(.+)\s+has\s+(.+)$/i);
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
        const resolvedAdj = resolvePredicateName(
            [adj, adj.toLowerCase(), capitalize(adj), `Is${capitalize(adj)}`],
            vocab
        );
        if (!resolvedAdj) throw makeError(`Unknown predicate: ${adj}`, 'E_UNKNOWN_PREDICATE');
        const expr = pred(resolvedAdj, [subject]);
        validatePredicate(resolvedAdj, expr.args, vocab);
        return expr;
    }

    const svoMatch = src.match(/^(.+)\s+(\w+)\s+(.+)$/i);
    if (svoMatch) {
        const subject = parseTerm(svoMatch[1], vocab, options, boundVars, freeVars);
        const verb = svoMatch[2];
        const resolvedVerb = resolvePredicateName([verb, verb.toLowerCase(), capitalize(verb)], vocab);
        if (!resolvedVerb) throw makeError(`Unknown predicate: ${verb}`, 'E_UNKNOWN_PREDICATE');
        const obj = parseTerm(svoMatch[3], vocab, options, boundVars, freeVars);
        const expr = pred(resolvedVerb, [subject, obj]);
        validatePredicate(resolvedVerb, expr.args, vocab);
        return expr;
    }

    if (src === 'true' || src === 'false') return boolLit(src === 'true');

    if (/\)\s+\w+\(/.test(src)) {
        throw makeError(`Missing connector in expression: ${src}`, 'E_CNL_MISSING_CONNECTOR');
    }
    throw makeError(`Unable to parse expression: ${src}`, 'E_CNL_SYNTAX');
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
    const normalized = text.endsWith(':') ? text.slice(0, -1).trim() : text.trim();
    const forMatch = normalized.match(/^For\s+(all|any|every|each)\s+(.+)$/i);
    if (forMatch) {
        const rest = forMatch[2].trim();
        const segments = rest.split(',').map((s) => s.trim()).filter(Boolean);
        const explicitBindings = [];
        let explicitOk = segments.length > 0;
        for (const segment of segments) {
            const parts = segment.split(/\s+/).filter(Boolean);
            if (parts.length !== 2) {
                explicitOk = false;
                break;
            }
            explicitBindings.push({ domain: parts[0], varName: stripVarToken(parts[1]) });
        }
        if (explicitOk && explicitBindings.length > 0) {
            return { kind: 'ForAll', bindings: explicitBindings };
        }
        const tokens = rest.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
        if (tokens.length < 2) return null;
        const domain = tokens[0];
        const vars = tokens.slice(1).map(stripVarToken).filter(Boolean);
        if (vars.length === 0) return null;
        return { kind: 'ForAll', bindings: vars.map((varName) => ({ domain, varName })) };
    }
    const eachMatch = normalized.match(/^(Each|Every)\s+(\w+)\s+(\$?\w+)$/i);
    if (eachMatch) {
        return {
            kind: 'ForAll',
            bindings: [{ domain: eachMatch[2], varName: stripVarToken(eachMatch[3]) }]
        };
    }
    const existsMatch = normalized.match(/^(There\s+exists|Exists)\s+(?:an?\s+)?(\w+)\s+(\$?\w+)$/i);
    if (existsMatch) {
        return {
            kind: 'Exists',
            bindings: [{ domain: existsMatch[2], varName: stripVarToken(existsMatch[3]) }]
        };
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
            throw makeError(`Unexpected indentation at line ${idx + 1}`, 'E_CNL_SYNTAX');
        }

        if (isDeclarationLine(text)) {
            idx++;
            continue;
        }

        const needsPeriod = !text.endsWith(':') && !text.endsWith('?');
        if (needsPeriod && !text.endsWith('.')) {
            throw makeError(`Missing period at line ${idx + 1}`, 'E_CNL_MISSING_PERIOD');
        }

        const quant = parseQuantifierLine(text);
        if (quant) {
            const scopeBindings = new Map();
            for (const binding of quant.bindings) {
                if (!vocab.domains.has(binding.domain)) {
                    if (options.updateVocab) vocab.addDomain(binding.domain);
                    else throw makeError(`Unknown domain: ${binding.domain}`, 'E_UNKNOWN_TYPE');
                }
                scopeBindings.set(binding.varName, binding.domain);
            }
            boundVars.push(scopeBindings);
            const inner = parseStatements(lines, idx + 1, baseIndent + 4, vocab, options, boundVars);
            boundVars.pop();
            for (const stmt of inner.statements) {
                const quantifiers = quant.bindings.map((binding) => ({
                    kind: quant.kind,
                    varName: binding.varName,
                    domain: binding.domain
                }));
                const wrapped = wrapWithQuantifiers(stmt.expr, quantifiers);
                statements.push(assertStmt(wrapped));
            }
            idx = inner.nextIndex;
            continue;
        }

        const whichMatch = text.match(/^Which\s+(\w+)\s+(\$\w+)\s+(.+)\?$/i);
        if (whichMatch) {
            const domain = whichMatch[1];
            const varName = whichMatch[2].slice(1);
            if (!vocab.domains.has(domain)) {
                if (options.updateVocab) vocab.addDomain(domain);
                else throw makeError(`Unknown domain: ${domain}`, 'E_UNKNOWN_TYPE');
            }
            const newScope = new Map();
            newScope.set(varName, domain);
            boundVars.push(newScope);
            const freeVars = [];
            const expr = parseExpr(`${whichMatch[2]} ${whichMatch[3]}`, vocab, options, boundVars, freeVars);
            boundVars.pop();
            let wrapped = exists(varName, domain, expr);
            if (freeVars.length > 0) {
                const quantifiers = freeVars.map((name) => ({
                    kind: 'ForAll',
                    varName: name,
                    domain: options.implicitDomain
                }));
                wrapped = wrapWithQuantifiers(wrapped, quantifiers);
            }
            statements.push(assertStmt(wrapped));
            idx++;
            continue;
        }

        if (text.startsWith('If ')) {
            const ifMatch = text.match(/^If\s+(.+)\s+then\s+(.+)\.?$/i);
            if (!ifMatch) throw makeError(`Malformed If statement at line ${idx + 1}`, 'E_CNL_SYNTAX');
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
