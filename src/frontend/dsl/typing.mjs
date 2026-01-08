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

function parseTermTokens(tokens, startIndex, scope, vocab, options) {
    const token = tokens[startIndex];
    if (!token) throw new Error('Missing term');

    if (token.startsWith('$')) {
        const name = token.slice(1);
        const domain = scope.vars.get(name);
        if (!domain) throw new Error(`Unbound variable: ${name}`);
        return { term: varRef(name, domain), nextIndex: startIndex + 1 };
    }

    if (isNumericLiteral(token)) {
        const domain = options.numericDomain;
        if (!vocab.domains.has(domain)) vocab.addDomain(domain);
        if (!vocab.hasConst(token) && options.allowNumericLiterals) {
            vocab.addConst(token, domain);
        }
        if (!vocab.hasConst(token)) throw new Error(`Unknown numeric literal: ${token}`);
        return { term: constRef(token, vocab.getConstDomain(token)), nextIndex: startIndex + 1 };
    }

    if (vocab.hasConst(token)) {
        return { term: constRef(token, vocab.getConstDomain(token)), nextIndex: startIndex + 1 };
    }

    const funcSig = vocab.getFuncSignature(token);
    if (funcSig) {
        let idx = startIndex + 1;
        const args = [];
        for (let i = 0; i < funcSig.args.length; i++) {
            const parsed = parseTermTokens(tokens, idx, scope, vocab, options);
            args.push(parsed.term);
            idx = parsed.nextIndex;
        }
        const term = { kind: 'Func', name: token, args };
        validateFuncTerm(term, vocab);
        return { term, nextIndex: idx };
    }

    throw new Error(`Unknown term: ${token}`);
}

function resolveExprRef(token, scope) {
    if (token === 'true' || token === 'false') return boolLit(token === 'true');
    if (!token.startsWith('$')) {
        throw new Error(`Expected expression reference, got ${token}`);
    }
    const name = token.slice(1);
    const expr = scope.exprs.get(name);
    if (!expr) throw new Error(`Unknown expression reference: ${name}`);
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
    if (!head) throw new Error('Empty expression');

    if (head === 'Not') {
        if (tokens.length !== 2) throw new Error('Not expects one operand');
        return notExpr(resolveExprRef(tokens[1], scope));
    }
    if (head === 'And' || head === 'Or') {
        if (tokens.length < 3) throw new Error(`${head} expects at least two operands`);
        const args = tokens.slice(1).map((t) => resolveExprRef(t, scope));
        return foldBinary(head, args);
    }
    if (head === 'Implies' || head === 'Iff') {
        if (tokens.length !== 3) throw new Error(`${head} expects two operands`);
        const left = resolveExprRef(tokens[1], scope);
        const right = resolveExprRef(tokens[2], scope);
        return head === 'Implies' ? impliesExpr(left, right) : iffExpr(left, right);
    }
    if (head === 'Eq') {
        if (tokens.length < 3) throw new Error('Eq expects two terms');
        const left = parseTermTokens(tokens, 1, scope, vocab, options).term;
        const right = parseTermTokens(tokens, 2, scope, vocab, options).term;
        return eqExpr(left, right);
    }

    const sig = vocab.getPredSignature(head);
    if (!sig) throw new Error(`Unknown predicate: ${head}`);
    let idx = 1;
    const args = [];
    for (let i = 0; i < sig.length; i++) {
        const parsed = parseTermTokens(tokens, idx, scope, vocab, options);
        args.push(parsed.term);
        idx = parsed.nextIndex;
    }
    if (idx < tokens.length) {
        throw new Error(`Too many arguments for predicate ${head}`);
    }
    validatePredicate(head, args, vocab);
    return pred(head, args);
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
            vocab.addConst(tokens[1], tokens[2]);
        } else if (head === 'Pred' && tokens.length >= 2) {
            vocab.addPred(tokens[1], tokens.slice(2));
        } else if (head === 'Func' && tokens.length >= 3) {
            const args = tokens.slice(2, -1);
            const ret = tokens[tokens.length - 1];
            vocab.addFunc(tokens[1], args, ret);
        } else if (head === 'SubType' && tokens.length >= 3) {
            vocab.addSubType(tokens[1], tokens[2]);
        }
        idx++;
    }
    throw new Error('Unclosed Vocab block');
}

function parseNamedLine(line) {
    const parts = line.split(/\s+/u);
    const namePart = parts[0];
    const name = namePart.slice(1).split(':')[0];
    const rest = parts.slice(1);
    return { name, rest };
}

function parseForAllLine(rest) {
    if (rest.length < 4) throw new Error('Malformed ForAll/Exists line');
    const kind = rest[0];
    const domain = rest[1];
    if (rest[2] !== 'graph') throw new Error('Expected graph in quantifier header');
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

        if (line.startsWith('IsA ')) {
            const tokens = line.split(/\s+/u);
            if (tokens.length >= 3) vocab.addConst(tokens[1], tokens[2]);
            idx++;
            continue;
        }

        if (!line.startsWith('@')) {
            idx++;
            continue;
        }

        const { name, rest } = parseNamedLine(line);
        if (rest[0] === '__Atom' || rest[0] === 'graph') {
            idx++;
            continue;
        }

        if (rest[0] === 'ForAll' || rest[0] === 'Exists') {
            const quant = parseForAllLine(rest);
            if (!vocab.domains.has(quant.domain)) vocab.addDomain(quant.domain);
            localScope.vars.set(quant.varName, quant.domain);
            const inner = parseBlock(lines, idx + 1, vocab, localScope, options);
            localScope.vars.delete(quant.varName);
            if (!inner.expr) throw new Error(`Missing return in block for ${name}`);
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

    throw new Error('Unclosed block (missing end)');
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
            idx++;
            continue;
        }

        if (line.startsWith('Vocab')) {
            idx = parseVocabBlock(lines, idx + 1, vocab);
            continue;
        }

        if (line.startsWith('IsA ')) {
            const tokens = line.split(/\s+/u);
            if (tokens.length >= 3) vocab.addConst(tokens[1], tokens[2]);
            idx++;
            continue;
        }

        if (!line.startsWith('@')) {
            const expr = parseExpressionTokens(line.split(/\s+/u), scope, vocab, options);
            statements.push(assertStmt(expr));
            idx++;
            continue;
        }

        const { name, rest } = parseNamedLine(line);
        if (rest[0] === '__Atom' || rest[0] === 'graph') {
            idx++;
            continue;
        }

        if (rest[0] === 'ForAll' || rest[0] === 'Exists') {
            const quant = parseForAllLine(rest);
            if (!vocab.domains.has(quant.domain)) vocab.addDomain(quant.domain);
            scope.vars.set(quant.varName, quant.domain);
            const inner = parseBlock(lines, idx + 1, vocab, scope, options);
            scope.vars.delete(quant.varName);
            if (!inner.expr) throw new Error(`Missing return in block for ${name}`);
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
        allowNumericLiterals: options.allowNumericLiterals !== false
    };
    const lines = dslSource.split(/\r?\n/u);
    const statements = parseTopLevel(lines, vocab, cfg);
    return { vocab, statements };
}
