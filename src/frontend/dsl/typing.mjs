import fs from 'fs';
import path from 'path';

import {
    assertStmt,
    pred,
    andExpr,
    orExpr,
    notExpr,
    impliesExpr,
    iffExpr,
    eqExpr,
    forAll,
    exists,
    varRef,
    constRef,
    boolLit
} from '../logic/ast.mjs';
import { Vocabulary } from '../schema/vocab.mjs';

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
    return line.slice(0, end).trim();
}

function isNumericLiteral(text) {
    return /^\d+(\/\d+)?$/.test(text) || /^\d*\.\d+$/.test(text);
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

function parseTermTokens(tokens, startIndex, scope, vocab, options) {
    const token = tokens[startIndex];
    if (!token) throw makeError('Missing term', 'E_DSL_SYNTAX');

    if (token.startsWith('$')) {
        const name = token.slice(1);
        const domain = scope.vars.get(name);
        if (!domain) throw makeError(`Unbound variable: ${name}`, 'E_DSL_UNBOUND_VAR');
        return { term: varRef(name, domain), nextIndex: startIndex + 1 };
    }

    if (isNumericLiteral(token)) {
        const domain = options.numericDomain;
        if (!vocab.domains.has(domain)) vocab.addDomain(domain);
        if (!vocab.hasConst(token) && options.allowNumericLiterals) {
            vocab.addConst(token, domain);
        }
        const constName = vocab.resolveConstName(token);
        if (!constName) throw makeError(`Unknown numeric literal: ${token}`, 'E_UNKNOWN_SYMBOL');
        return { term: constRef(constName, vocab.getConstDomain(constName)), nextIndex: startIndex + 1 };
    }

    const constName = vocab.resolveConstName(token);
    if (constName) {
        return { term: constRef(constName, vocab.getConstDomain(constName)), nextIndex: startIndex + 1 };
    }

    const funcName = vocab.resolveFuncName(token);
    const funcSig = funcName ? vocab.getFuncSignature(funcName) : null;
    if (funcSig) {
        let idx = startIndex + 1;
        const args = [];
        for (let i = 0; i < funcSig.args.length; i++) {
            const parsed = parseTermTokens(tokens, idx, scope, vocab, options);
            args.push(parsed.term);
            idx = parsed.nextIndex;
        }
        const term = { kind: 'Func', name: funcName, args };
        validateFuncTerm(term, vocab);
        return { term, nextIndex: idx };
    }

    throw makeError(`Unknown term: ${token}`, 'E_UNKNOWN_SYMBOL');
}

function resolveExprRef(token, scope) {
    if (token === 'true' || token === 'false') return boolLit(token === 'true');
    if (!token.startsWith('$')) {
        throw makeError(`Expected expression reference, got ${token}`, 'E_DSL_SYNTAX');
    }
    const name = token.slice(1);
    const expr = scope.exprs.get(name);
    if (!expr) throw makeError(`Unknown expression reference: ${name}`, 'E_DSL_UNBOUND_VAR');
    return expr;
}

function foldBinary(op, args) {
    return args.reduce((acc, next) => {
        if (!acc) return next;
        if (op === 'And') return andExpr(acc, next);
        if (op === 'Or') return orExpr(acc, next);
        return acc;
    }, null);
}

function parseExpressionTokens(tokens, scope, vocab, options) {
    const head = tokens[0];
    if (!head) throw makeError('Empty expression', 'E_DSL_SYNTAX');

    if (head === 'Not') {
        if (tokens.length !== 2) throw makeError('Not expects one operand', 'E_DSL_SYNTAX');
        return notExpr(resolveExprRef(tokens[1], scope));
    }
    if (head === 'And' || head === 'Or') {
        if (tokens.length < 3) throw makeError(`${head} expects at least two operands`, 'E_DSL_SYNTAX');
        const args = tokens.slice(1).map((t) => resolveExprRef(t, scope));
        return foldBinary(head, args);
    }
    if (head === 'Implies' || head === 'Iff') {
        if (tokens.length !== 3) throw makeError(`${head} expects two operands`, 'E_DSL_SYNTAX');
        const left = resolveExprRef(tokens[1], scope);
        const right = resolveExprRef(tokens[2], scope);
        return head === 'Implies' ? impliesExpr(left, right) : iffExpr(left, right);
    }
    if (head === 'Eq') {
        if (tokens.length < 3) throw makeError('Eq expects two terms', 'E_DSL_SYNTAX');
        const left = parseTermTokens(tokens, 1, scope, vocab, options).term;
        const right = parseTermTokens(tokens, 2, scope, vocab, options).term;
        return eqExpr(left, right);
    }

    const predName = vocab.resolvePredName(head);
    if (!predName) throw makeError(`Unknown predicate: ${head}`, 'E_UNKNOWN_PREDICATE');
    const sig = vocab.getPredSignature(predName);
    let idx = 1;
    const args = [];
    for (let i = 0; i < sig.length; i++) {
        const parsed = parseTermTokens(tokens, idx, scope, vocab, options);
        args.push(parsed.term);
        idx = parsed.nextIndex;
    }
    if (idx < tokens.length) {
        throw makeError(`Too many arguments for predicate ${predName}`, 'E_ARITY_MISMATCH');
    }
    validatePredicate(predName, args, vocab);
    return pred(predName, args);
}

function parseVocabBlock(lines, startIndex, vocab) {
    let idx = startIndex;
    while (idx < lines.length) {
        const line = stripComments(lines[idx]);
        if (!line) {
            idx++;
            continue;
        }
        if (line === 'end') return idx + 1;
        const tokens = line.split(/\s+/u);
        const head = tokens[0];
        if (head === 'Domain' && tokens[1]) {
            vocab.addDomain(tokens[1]);
        } else if (head === 'Const' && tokens.length >= 3) {
            if (!vocab.domains.has(tokens[2])) {
                throw makeError(`Unknown domain: ${tokens[2]}`, 'E_UNKNOWN_TYPE');
            }
            vocab.addConst(tokens[1], tokens[2]);
        } else if (head === 'Pred' && tokens.length >= 2) {
            vocab.addPred(tokens[1], tokens.slice(2));
        } else if (head === 'Func' && tokens.length >= 3) {
            const args = tokens.slice(2, -1);
            const ret = tokens[tokens.length - 1];
            vocab.addFunc(tokens[1], args, ret);
        } else if (head === 'SubType' && tokens.length >= 3) {
            vocab.addSubType(tokens[1], tokens[2]);
        } else if (head === 'Alias' && tokens.length >= 3) {
            vocab.addAlias(tokens[1], tokens[2]);
        }
        idx++;
    }
    throw makeError('Unclosed Vocab block', 'E_DSL_MISSING_END');
}

function parseNamedLine(line) {
    const parts = line.split(/\s+/u);
    const namePart = parts[0];
    const raw = namePart.slice(1);
    const split = raw.split(':');
    const name = split[0];
    const kbName = split[1] || null;
    const rest = parts.slice(1);
    return { name, kbName, rest };
}

function parseForAllLine(rest) {
    if (rest.length < 4) throw makeError('Malformed ForAll/Exists line', 'E_DSL_SYNTAX');
    const kind = rest[0];
    const domain = rest[1];
    if (rest[2] !== 'graph') throw makeError('Expected graph in quantifier header', 'E_DSL_SYNTAX');
    const varName = rest[3];
    return { kind, domain, varName };
}

function parseBlock(lines, startIndex, vocab, scope, options) {
    const localScope = {
        vars: new Map(scope.vars),
        exprs: new Map(scope.exprs)
    };
    let idx = startIndex;
    let returnExpr = null;

    while (idx < lines.length) {
        const line = stripComments(lines[idx]);
        if (!line) {
            idx++;
            continue;
        }
        if (line === 'end') return { expr: returnExpr, nextIndex: idx + 1 };

        if (line.startsWith('return ')) {
            const token = line.slice('return '.length).trim();
            returnExpr = resolveExprRef(token, localScope);
            idx++;
            continue;
        }

        if (line.startsWith('Vocab')) {
            idx = parseVocabBlock(lines, idx + 1, vocab);
            continue;
        }

        if (line.startsWith('Alias ')) {
            const tokens = line.split(/\s+/u);
            if (tokens.length >= 3) vocab.addAlias(tokens[1], tokens[2]);
            idx++;
            continue;
        }

        if (line.startsWith('IsA ')) {
            const tokens = line.split(/\s+/u);
            if (tokens.length >= 3) {
                const constName = vocab.resolveAlias(tokens[1]);
                if (!vocab.domains.has(tokens[2])) {
                    throw makeError(`Unknown domain: ${tokens[2]}`, 'E_UNKNOWN_TYPE');
                }
                vocab.addConst(constName, tokens[2]);
            }
            idx++;
            continue;
        }

        if (!line.startsWith('@')) {
            idx++;
            continue;
        }

        const { name, kbName, rest } = parseNamedLine(line);
        if (rest[0] === '__Atom') {
            const atomName = kbName || name;
            if (!vocab.hasConst(atomName) && options.implicitDomain) {
                if (!vocab.domains.has(options.implicitDomain)) {
                    vocab.addDomain(options.implicitDomain);
                }
                vocab.addConst(atomName, options.implicitDomain);
            }
            idx++;
            continue;
        }
        if (rest[0] === 'graph') {
            idx++;
            continue;
        }

        if (rest.some((token) => token.startsWith('@'))) {
            throw makeError('Two @ tokens on one line', 'E_DSL_TWO_AT');
        }

        if (rest[0] === 'ForAll' || rest[0] === 'Exists') {
            const quant = parseForAllLine(rest);
            if (!vocab.domains.has(quant.domain)) vocab.addDomain(quant.domain);
            localScope.vars.set(quant.varName, quant.domain);
            const inner = parseBlock(lines, idx + 1, vocab, localScope, options);
            localScope.vars.delete(quant.varName);
            if (!inner.expr) throw makeError(`Missing return in block for ${name}`, 'E_DSL_MISSING_RETURN');
            const expr = quant.kind === 'Exists'
                ? exists(quant.varName, quant.domain, inner.expr)
                : forAll(quant.varName, quant.domain, inner.expr);
            localScope.exprs.set(name, expr);
            idx = inner.nextIndex;
            continue;
        }

        const expr = parseExpressionTokens(rest, localScope, vocab, options);
        localScope.exprs.set(name, expr);
        idx++;
    }

    throw makeError('Unclosed block (missing end)', 'E_DSL_MISSING_END');
}

function parseTopLevel(lines, vocab, options) {
    const statements = [];
    let idx = 0;

    const scope = { vars: new Map(), exprs: new Map() };

    while (idx < lines.length) {
        const line = stripComments(lines[idx]);
        if (!line) {
            idx++;
            continue;
        }

        if (line.startsWith('load ')) {
            const match = line.match(/^load\s+"([^"]+)"$/);
            if (match && path.isAbsolute(match[1])) {
                throw makeError(`Absolute paths are forbidden: ${match[1]}`, 'E_DSL_ABSOLUTE_PATH');
            }
            idx++;
            continue;
        }

        if (line.startsWith('Vocab')) {
            idx = parseVocabBlock(lines, idx + 1, vocab);
            continue;
        }

        if (line.startsWith('Alias ')) {
            const tokens = line.split(/\s+/u);
            if (tokens.length >= 3) vocab.addAlias(tokens[1], tokens[2]);
            idx++;
            continue;
        }

        if (line.startsWith('IsA ')) {
            const tokens = line.split(/\s+/u);
            if (tokens.length >= 3) {
                const constName = vocab.resolveAlias(tokens[1]);
                if (!vocab.domains.has(tokens[2])) {
                    throw makeError(`Unknown domain: ${tokens[2]}`, 'E_UNKNOWN_TYPE');
                }
                vocab.addConst(constName, tokens[2]);
            }
            idx++;
            continue;
        }

        if (!line.startsWith('@')) {
            const expr = parseExpressionTokens(line.split(/\s+/u), scope, vocab, options);
            statements.push(assertStmt(expr));
            idx++;
            continue;
        }

        const { name, kbName, rest } = parseNamedLine(line);
        if (rest[0] === '__Atom') {
            const atomName = kbName || name;
            if (!vocab.hasConst(atomName) && options.implicitDomain) {
                if (!vocab.domains.has(options.implicitDomain)) {
                    vocab.addDomain(options.implicitDomain);
                }
                vocab.addConst(atomName, options.implicitDomain);
            }
            idx++;
            continue;
        }
        if (rest[0] === 'graph') {
            idx++;
            continue;
        }

        if (rest.some((token) => token.startsWith('@'))) {
            throw makeError('Two @ tokens on one line', 'E_DSL_TWO_AT');
        }

        if (rest[0] === 'ForAll' || rest[0] === 'Exists') {
            const quant = parseForAllLine(rest);
            if (!vocab.domains.has(quant.domain)) vocab.addDomain(quant.domain);
            scope.vars.set(quant.varName, quant.domain);
            const inner = parseBlock(lines, idx + 1, vocab, scope, options);
            scope.vars.delete(quant.varName);
            if (!inner.expr) throw makeError(`Missing return in block for ${name}`, 'E_DSL_MISSING_RETURN');
            const expr = quant.kind === 'Exists'
                ? exists(quant.varName, quant.domain, inner.expr)
                : forAll(quant.varName, quant.domain, inner.expr);
            statements.push(assertStmt(expr));
            idx = inner.nextIndex;
            continue;
        }

        const expr = parseExpressionTokens(rest, scope, vocab, options);
        statements.push(assertStmt(expr));
        idx++;
    }

    return statements;
}

export function parseDslToTypedAst(dslSource, options = {}) {
    const vocab = options.vocab || new Vocabulary();
    const cfg = {
        numericDomain: options.numericDomain || 'Int',
        allowNumericLiterals: options.allowNumericLiterals !== false,
        implicitDomain: options.implicitDomain || 'Entity',
        baseDir: options.baseDir || process.cwd(),
        loadFiles: options.loadFiles === true,
        visited: options.visited || new Set()
    };
    const lines = dslSource.split(/\r?\n/u);
    const statements = [];

    if (cfg.loadFiles) {
        for (const line of lines) {
            const match = stripComments(line).match(/^load\s+"([^"]+)"$/);
            if (!match) continue;
            const loadPath = match[1];
            if (path.isAbsolute(loadPath)) {
                throw makeError(`Absolute paths are forbidden: ${loadPath}`, 'E_DSL_ABSOLUTE_PATH');
            }
            const resolved = path.resolve(cfg.baseDir, loadPath);
            if (cfg.visited.has(resolved)) continue;
            cfg.visited.add(resolved);
            const content = fs.readFileSync(resolved, 'utf8');
            const loaded = parseDslToTypedAst(content, {
                vocab,
                numericDomain: cfg.numericDomain,
                allowNumericLiterals: cfg.allowNumericLiterals,
                implicitDomain: cfg.implicitDomain,
                baseDir: path.dirname(resolved),
                loadFiles: true,
                visited: cfg.visited
            });
            statements.push(...loaded.statements);
        }
    }

    statements.push(...parseTopLevel(lines, vocab, cfg));
    return { vocab, statements };
}
