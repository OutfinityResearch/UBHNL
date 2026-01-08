function isVariable(term) {
    return typeof term === 'string' && term.startsWith('$');
}

function unifyArgs(patternArgs, factArgs, bindings) {
    if (patternArgs.length !== factArgs.length) return null;
    const next = { ...bindings };

    for (let i = 0; i < patternArgs.length; i++) {
        const pat = patternArgs[i];
        const val = factArgs[i];
        if (isVariable(pat)) {
            const bound = next[pat];
            if (bound && bound !== val) return null;
            next[pat] = val;
        } else if (pat !== val) {
            return null;
        }
    }

    return next;
}

function instantiateArgs(args, bindings) {
    const out = [];
    for (const term of args) {
        if (isVariable(term)) {
            const bound = bindings[term];
            if (!bound) return null;
            out.push(bound);
        } else {
            out.push(term);
        }
    }
    return out;
}

export class Session {
    constructor() {
        this.factsByPred = new Map();
        this.factIndex = new Set();
        this.rules = [];
    }

    addFact(pred, args) {
        if (typeof pred !== 'string' || !Array.isArray(args)) {
            throw new Error('addFact expects (pred, args[])');
        }
        const key = `${pred}|${args.join('|')}`;
        if (this.factIndex.has(key)) return false;
        this.factIndex.add(key);

        if (!this.factsByPred.has(pred)) this.factsByPred.set(pred, []);
        this.factsByPred.get(pred).push(args);
        return true;
    }

    addRule(rule) {
        if (!rule || !Array.isArray(rule.if) || !rule.then) {
            throw new Error('addRule expects { if: [...], then: {...} }');
        }
        this.rules.push(rule);
    }

    hasFact(pred, args) {
        return this.factIndex.has(`${pred}|${args.join('|')}`);
    }

    applyRules(options = {}) {
        const { maxIterations = 1 } = options;
        for (let iter = 0; iter < maxIterations; iter++) {
            let added = 0;

            for (const rule of this.rules) {
                const bindingsList = this.matchAntecedents(rule.if, 0, {});
                for (const bindings of bindingsList) {
                    const instantiated = instantiateArgs(rule.then.args, bindings);
                    if (!instantiated) continue;
                    if (this.addFact(rule.then.pred, instantiated)) {
                        added += 1;
                    }
                }
            }

            if (added === 0) break;
        }
    }

    matchAntecedents(antecedents, idx, bindings) {
        if (idx >= antecedents.length) return [bindings];

        const current = antecedents[idx];
        const facts = this.factsByPred.get(current.pred) || [];
        const results = [];

        for (const args of facts) {
            const nextBindings = unifyArgs(current.args, args, bindings);
            if (!nextBindings) continue;
            results.push(...this.matchAntecedents(antecedents, idx + 1, nextBindings));
        }

        return results;
    }

    query(goal, options = {}) {
        if (!goal || typeof goal.pred !== 'string' || !Array.isArray(goal.args)) {
            throw new Error('query expects { pred, args }');
        }
        this.applyRules(options);
        return this.hasFact(goal.pred, goal.args);
    }
}
