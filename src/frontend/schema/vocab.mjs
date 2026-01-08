export class Vocabulary {
    constructor() {
        this.domains = new Map();
        this.consts = new Map();
        this.predicates = new Map();
        this.functions = new Map();
        this.subtypes = new Map();
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
        return this.predicates.get(name) || null;
    }

    getFuncSignature(name) {
        return this.functions.get(name) || null;
    }

    hasConst(name) {
        return this.consts.has(name);
    }

    getConstDomain(name) {
        return this.consts.get(name) || null;
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
