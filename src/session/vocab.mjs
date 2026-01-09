import { UbhnlError, E_UNKNOWN_TYPE, E_UNKNOWN_SYMBOL, E_REDECLARATION } from '../utils/errors.mjs';
import { injectBuiltins } from './builtins.mjs';

/**
 * @typedef {Object} SymbolInfo
 * @property {'Domain'|'Const'|'Pred'|'Func'} kind
 * @property {string|string[]} [type]
 * @property {string} [returnType]
 */

export class Vocabulary {
    constructor() {
        this.domains = new Set();
        this.constants = new Map(); // name -> domain
        this.predicates = new Map(); // name -> argTypes[]
        this.functions = new Map(); // name -> { args, ret }
        this.aliases = new Map(); // alias -> target

        injectBuiltins(this);
    }

    addDomain(name) {
        if (this.domains.has(name)) return; // Idempotent
        this.domains.add(name);
    }

    addConst(name, domain) {
        if (!this.domains.has(domain)) {
            throw new UbhnlError(E_UNKNOWN_TYPE, `Unknown domain '${domain}' for constant '${name}'`, 'TheoryFile');
        }
        if (this.constants.has(name)) {
            // Allow redeclaration if same domain (idempotent)
            if (this.constants.get(name) !== domain) {
                throw new UbhnlError(E_REDECLARATION, `Constant '${name}' redeclared with different domain`, 'TheoryFile');
            }
            return;
        }
        this.constants.set(name, domain);
    }

    addPredicate(name, argTypes) {
        this._validateTypes(argTypes);
        this.predicates.set(name, argTypes);
    }

    addFunction(name, argTypes, returnType) {
        this._validateTypes(argTypes);
        if (!this.domains.has(returnType)) {
            throw new UbhnlError(E_UNKNOWN_TYPE, `Unknown return type '${returnType}'`, 'TheoryFile');
        }
        this.functions.set(name, { args: argTypes, ret: returnType });
    }

    addAlias(alias, target) {
        this.aliases.set(alias, target);
    }

    /**
     * @param {string} name 
     * @returns {SymbolInfo}
     */
    resolveSymbol(name) {
        // Resolve aliases
        let target = name;
        while (this.aliases.has(target)) {
            target = this.aliases.get(target);
            // TODO: Detect cycles
        }

        if (this.domains.has(target)) return { kind: 'Domain' };
        if (this.constants.has(target)) return { kind: 'Const', type: this.constants.get(target) };
        if (this.predicates.has(target)) return { kind: 'Pred', type: this.predicates.get(target) };
        if (this.functions.has(target)) {
            const f = this.functions.get(target);
            return { kind: 'Func', type: f.args, returnType: f.ret };
        }

        throw new UbhnlError(E_UNKNOWN_SYMBOL, `Unknown symbol '${name}'`, 'UserInput');
    }

    _validateTypes(types) {
        for (const t of types) {
            if (!this.domains.has(t)) {
                throw new UbhnlError(E_UNKNOWN_TYPE, `Unknown type '${t}' in signature`, 'TheoryFile');
            }
        }
    }

    merge(other) {
        for (const d of other.domains) this.addDomain(d);
        for (const [c, d] of other.constants) this.addConst(c, d);
        for (const [p, args] of other.predicates) this.addPredicate(p, args);
        for (const [f, sig] of other.functions) this.addFunction(f, sig.args, sig.ret);
        for (const [a, t] of other.aliases) this.addAlias(a, t);
    }
}
