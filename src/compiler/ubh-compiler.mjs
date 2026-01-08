import { Kernel } from '../kernel/index.mjs';

function ensureVocab(options) {
    const vocab = options.vocab;
    if (!vocab) {
        throw new Error('compile requires a vocabulary');
    }
    return vocab;
}

function normalizeVarName(name) {
    return name.startsWith('$') ? name.slice(1) : name;
}

function resolveConst(term, vocab) {
    if (typeof term === 'string') {
        const domain = vocab.getConstDomain(term);
        if (!domain) throw new Error(`Unknown constant: ${term}`);
        return { name: term, domain };
    }
    if (term && term.kind === 'ConstRef') {
        const domain = vocab.getConstDomain(term.name);
        if (!domain) throw new Error(`Unknown constant: ${term.name}`);
        if (term.domain && !vocab.isCompatible(domain, term.domain)) {
            throw new Error(`Type mismatch for ${term.name}: expected ${term.domain}, got ${domain}`);
        }
        return { name: term.name, domain };
    }
    return null;
}

function resolveNumeric(term, vocab, options) {
    if (!term || term.kind !== 'NumLit') return null;
    const domain = term.domain || options.numericDomain || 'Int';
    if (!vocab.domains.has(domain)) {
        if (options.allowNumericLiterals === false) {
            throw new Error(`Numeric domain not declared: ${domain}`);
        }
        vocab.addDomain(domain);
    }
    if (!vocab.hasConst(term.value)) {
        if (options.allowNumericLiterals === false) {
            throw new Error(`Unknown numeric literal: ${term.value}`);
        }
        vocab.addConst(term.value, domain);
    }
    const constDomain = vocab.getConstDomain(term.value);
    return { name: term.value, domain: constDomain };
}

function resolveFunctionTerm(term, vocab, env, options) {
    if (!term || term.kind !== 'Func') return null;
    const sig = vocab.getFuncSignature(term.name);
    if (!sig) throw new Error(`Unknown function: ${term.name}`);
    if (sig.args.length !== term.args.length) {
        throw new Error(`Arity mismatch for function ${term.name}: expected ${sig.args.length}, got ${term.args.length}`);
    }
    const args = term.args.map((arg) => resolveGroundTerm(arg, vocab, env, options));
    const resolver = options.funcResolver;
    if (typeof resolver !== 'function') {
        throw new Error(`Function terms require funcResolver: ${term.name}`);
    }
    const resolved = resolver({ name: term.name, args: args.map(a => a.name), returnType: sig.returnType });
    const constName = typeof resolved === 'string' ? resolved : resolved?.name;
    if (!constName) throw new Error(`funcResolver did not return a constant for ${term.name}`);
    let domain = vocab.getConstDomain(constName);
    if (!domain) {
        if (!options.allowImplicitFuncConsts) {
            throw new Error(`Unknown function result constant: ${constName}`);
        }
        vocab.addConst(constName, sig.returnType);
        domain = sig.returnType;
    }
    if (!vocab.isCompatible(domain, sig.returnType)) {
        throw new Error(`Type mismatch for function ${term.name} result: expected ${sig.returnType}, got ${domain}`);
    }
    return { name: constName, domain };
}

function resolveGroundTerm(term, vocab, env, options) {
    if (term && term.kind === 'VarRef') {
        const varName = normalizeVarName(term.name);
        const bound = env.get(varName);
        if (!bound) throw new Error(`Unbound variable: ${varName}`);
        const domain = vocab.getConstDomain(bound);
        if (!domain) throw new Error(`Unknown constant: ${bound}`);
        return { name: bound, domain };
    }
    const numeric = resolveNumeric(term, vocab, options);
    if (numeric) return numeric;
    const func = resolveFunctionTerm(term, vocab, env, options);
    if (func) return func;
    if (typeof term === 'string' && term.startsWith('$')) {
        const varName = normalizeVarName(term);
        const bound = env.get(varName);
        if (!bound) throw new Error(`Unbound variable: ${varName}`);
        const domain = vocab.getConstDomain(bound);
        if (!domain) throw new Error(`Unknown constant: ${bound}`);
        return { name: bound, domain };
    }
    const constant = resolveConst(term, vocab);
    if (!constant) {
        throw new Error('Unsupported term kind');
    }
    return constant;
}

function varKey(name, args) {
    return args.length === 0 ? name : `${name}(${args.join(',')})`;
}

function compileNot(wire, kernel) {
    return kernel.xor(kernel.const1(), wire);
}

function compileOr(lhs, rhs, kernel) {
    const axb = kernel.xor(lhs, rhs);
    const aandb = kernel.and(lhs, rhs);
    return kernel.xor(axb, aandb);
}

function compileImplies(lhs, rhs, kernel) {
    return compileOr(compileNot(lhs, kernel), rhs, kernel);
}

export function compileExpr(expr, options = {}) {
    const vocab = ensureVocab(options);
    const kernel = options.kernel || new Kernel();
    const env = options.env || new Map();
    const settings = {
        numericDomain: options.numericDomain || 'Int',
        allowNumericLiterals: options.allowNumericLiterals !== false,
        allowImplicitFuncConsts: options.allowImplicitFuncConsts === true,
        funcResolver: options.funcResolver || null
    };

    switch (expr.kind) {
        case 'BoolLit':
            return expr.value ? kernel.const1() : kernel.const0();
        case 'Pred': {
            const sig = vocab.getPredSignature(expr.name);
            if (!sig) throw new Error(`Unknown predicate: ${expr.name}`);
            if (sig.length !== expr.args.length) {
                throw new Error(`Arity mismatch for ${expr.name}: expected ${sig.length}, got ${expr.args.length}`);
            }
            const args = expr.args.map((arg, idx) => {
                const resolved = resolveGroundTerm(arg, vocab, env, settings);
                const expected = sig[idx];
                if (!vocab.isCompatible(resolved.domain, expected)) {
                    throw new Error(`Type mismatch for ${expr.name} arg ${idx}: expected ${expected}, got ${resolved.domain}`);
                }
                return resolved.name;
            });
            return kernel.var(varKey(expr.name, args));
        }
        case 'And':
            return kernel.and(
                compileExpr(expr.lhs, { vocab, kernel, env, ...settings }),
                compileExpr(expr.rhs, { vocab, kernel, env, ...settings })
            );
        case 'Or':
            return compileOr(
                compileExpr(expr.lhs, { vocab, kernel, env, ...settings }),
                compileExpr(expr.rhs, { vocab, kernel, env, ...settings }),
                kernel
            );
        case 'Not':
            return compileNot(compileExpr(expr.expr, { vocab, kernel, env, ...settings }), kernel);
        case 'Implies':
            return compileImplies(
                compileExpr(expr.lhs, { vocab, kernel, env, ...settings }),
                compileExpr(expr.rhs, { vocab, kernel, env, ...settings }),
                kernel
            );
        case 'Iff': {
            const lhs = compileExpr(expr.lhs, { vocab, kernel, env, ...settings });
            const rhs = compileExpr(expr.rhs, { vocab, kernel, env, ...settings });
            return kernel.and(
                compileImplies(lhs, rhs, kernel),
                compileImplies(rhs, lhs, kernel)
            );
        }
        case 'Eq': {
            const left = resolveGroundTerm(expr.lhs, vocab, env, settings);
            const right = resolveGroundTerm(expr.rhs, vocab, env, settings);
            if (left.name === right.name) return kernel.const1();
            return kernel.const0();
        }
        case 'ForAll':
        case 'Exists': {
            const domain = expr.var?.domain;
            if (!domain) throw new Error('Quantifier missing domain');
            const elements = vocab.domainElements(domain);
            if (elements.length === 0) {
                return expr.kind === 'ForAll' ? kernel.const1() : kernel.const0();
            }
            let acc = null;
            for (const element of elements) {
                const nextEnv = new Map(env);
                nextEnv.set(normalizeVarName(expr.var.name), element);
                const compiled = compileExpr(expr.body, { vocab, kernel, env: nextEnv, ...settings });
                if (acc === null) {
                    acc = compiled;
                } else {
                    acc = expr.kind === 'ForAll'
                        ? kernel.and(acc, compiled)
                        : compileOr(acc, compiled, kernel);
                }
            }
            return acc;
        }
        default:
            throw new Error(`Unsupported expr kind: ${expr.kind}`);
    }
}

export function compileStatements(statements, options = {}) {
    if (!Array.isArray(statements)) {
        throw new Error('compileStatements expects an array of statements');
    }
    const vocab = ensureVocab(options);
    const kernel = options.kernel || new Kernel();
    const assertions = [];
    const wires = [];

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const expr = stmt?.kind === 'Assert' ? stmt.expr : stmt;
        if (!expr) throw new Error(`Invalid statement at index ${i}`);
        const wire = compileExpr(expr, { vocab, kernel, env: new Map() });
        wires.push(wire);
        assertions.push({ kind: 'assert1', wire });
    }

    return { kernel, wires, assertions };
}

export function compileFacts(facts, options = {}) {
    if (!Array.isArray(facts)) {
        throw new Error('compileFacts expects an array of facts');
    }
    const vocab = ensureVocab(options);
    const statements = facts.map((fact, idx) => {
        if (!fact || typeof fact.pred !== 'string' || !Array.isArray(fact.args)) {
            throw new Error(`Invalid fact at index ${idx}`);
        }
        const args = fact.args.map((arg) => {
            const domain = vocab.getConstDomain(arg);
            if (!domain) throw new Error(`Unknown constant: ${arg}`);
            return { kind: 'ConstRef', name: arg, domain };
        });
        return { kind: 'Assert', expr: { kind: 'Pred', name: fact.pred, args } };
    });
    return compileStatements(statements, options);
}
