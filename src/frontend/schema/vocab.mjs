export class Vocabulary {
    constructor() {
        this.domains = new Map();
        this.consts = new Map();
        this.predicates = new Map();
        this.functions = new Map();
        this.subtypes = new Map();
        this.aliases = new Map();
    }

    addDomain(name) {
        if (!name) throw new Error('Domain name is required');
        if (!this.domains.has(name)) {
            this.domains.set(name, new Set());
        }
    }

    addConst(name, domain) {
        if (!name || !domain) throw new Error('Const name and domain are required');
        this.addDomain(domain);
        this.domains.get(domain).add(name);
        this.consts.set(name, domain);
    }

    addPred(name, argTypes) {
        if (!name || !Array.isArray(argTypes)) {
            throw new Error('Predicate name and argTypes[] are required');
        }
        this.predicates.set(name, [...argTypes]);
    }

    addAlias(localName, globalName) {
        if (!localName || !globalName) {
            throw new Error('Alias requires local and global names');
        }
        this.aliases.set(localName, globalName);
    }

    resolveAlias(name) {
        let current = name;
        const seen = new Set();
        while (this.aliases.has(current) && !seen.has(current)) {
            seen.add(current);
            current = this.aliases.get(current);
        }
        return current;
    }

    resolveConstName(name) {
        const resolved = this.resolveAlias(name);
        return this.consts.has(resolved) ? resolved : null;
    }

    resolvePredName(name) {
        const resolved = this.resolveAlias(name);
        return this.predicates.has(resolved) ? resolved : null;
    }

    resolveFuncName(name) {
        const resolved = this.resolveAlias(name);
        return this.functions.has(resolved) ? resolved : null;
    }

    addFunc(name, argTypes, returnType) {
        if (!name || !Array.isArray(argTypes) || !returnType) {
            throw new Error('Function name, argTypes[], and returnType are required');
        }
        this.functions.set(name, { args: [...argTypes], returnType });
    }

    addSubType(child, parent) {
        if (!child || !parent) throw new Error('Subtype requires child and parent');
        if (!this.subtypes.has(parent)) this.subtypes.set(parent, new Set());
        this.subtypes.get(parent).add(child);
    }

    getPredSignature(name) {
        const resolved = this.resolvePredName(name) || name;
        return this.predicates.get(resolved) || null;
    }

    getFuncSignature(name) {
        const resolved = this.resolveFuncName(name) || name;
        return this.functions.get(resolved) || null;
    }

    hasConst(name) {
        return this.resolveConstName(name) !== null;
    }

    getConstDomain(name) {
        const resolved = this.resolveConstName(name) || name;
        return this.consts.get(resolved) || null;
    }

    isSubtype(child, parent) {
        if (child === parent) return true;
        const direct = this.subtypes.get(parent);
        if (!direct) return false;
        if (direct.has(child)) return true;
        for (const sub of direct) {
            if (this.isSubtype(child, sub)) return true;
        }
        return false;
    }

    isCompatible(actual, expected) {
        if (actual === expected) return true;
        return this.isSubtype(actual, expected);
    }

    domainElements(domain) {
        const seenDomains = new Set();
        const elements = [];

        const visit = (d) => {
            if (seenDomains.has(d)) return;
            seenDomains.add(d);
            const set = this.domains.get(d);
            if (set) elements.push(...set);
            const children = this.subtypes.get(d);
            if (children) {
                for (const child of children) visit(child);
            }
        };

        visit(domain);
        return elements;
    }
}
