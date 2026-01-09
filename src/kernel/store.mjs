import { OP_CONST0, OP_CONST1, OP_VAR, OP_XOR, OP_AND } from './constants.mjs';

/**
 * @typedef {number} NodeId
 */

/**
 * @typedef {Object} Wire
 * @property {number} op
 * @property {number} [a]
 * @property {number} [b]
 * @property {string} [label]
 */

export class WireStore {
    constructor() {
        /** @type {Wire[]} */
        this.wires = [];
        /** @type {Map<string, NodeId>} */
        this.cache = new Map();

        // Initialize CONST0 (id=0) and CONST1 (id=1)
        this.addWire({ op: OP_CONST0 });
        this.addWire({ op: OP_CONST1 });
    }

    /**
     * @param {Wire} wire 
     * @returns {NodeId}
     */
    addWire(wire) {
        const id = this.wires.length;
        this.wires.push(wire);
        return id;
    }

    const0() { return 0; }
    const1() { return 1; }

    /**
     * @param {string} label 
     * @returns {NodeId}
     */
    var(label) {
        // Variables are unique by label
        const key = `VAR:${label}`;
        if (this.cache.has(key)) return this.cache.get(key);

        const id = this.addWire({ op: OP_VAR, label });
        this.cache.set(key, id);
        return id;
    }

    /**
     * @param {NodeId} a 
     * @param {NodeId} b 
     * @returns {NodeId}
     */
    xor(a, b) {
        // Simplifications (DS-01)
        if (a === b) return this.const0(); // x ^ x = 0
        if (a === this.const0()) return b; // 0 ^ x = x
        if (b === this.const0()) return a; // x ^ 0 = x
        
        // Canonicalize: min(a,b) first
        const min = Math.min(a, b);
        const max = Math.max(a, b);

        const key = `XOR:${min}:${max}`;
        if (this.cache.has(key)) return this.cache.get(key);

        const id = this.addWire({ op: OP_XOR, a: min, b: max });
        this.cache.set(key, id);
        return id;
    }

    /**
     * @param {NodeId} a 
     * @param {NodeId} b 
     * @returns {NodeId}
     */
    and(a, b) {
        // Simplifications (DS-01)
        if (a === b) return a; // x & x = x
        if (a === this.const0() || b === this.const0()) return this.const0(); // x & 0 = 0
        if (a === this.const1()) return b; // 1 & x = x
        if (b === this.const1()) return a; // x & 1 = x

        // Canonicalize
        const min = Math.min(a, b);
        const max = Math.max(a, b);

        const key = `AND:${min}:${max}`;
        if (this.cache.has(key)) return this.cache.get(key);

        const id = this.addWire({ op: OP_AND, a: min, b: max });
        this.cache.set(key, id);
        return id;
    }

    not(a) {
        return this.xor(a, this.const1());
    }

    or(a, b) {
        // x | y = (x ^ y) ^ (x & y)
        const xorPart = this.xor(a, b);
        const andPart = this.and(a, b);
        return this.xor(xorPart, andPart);
    }

    getWire(id) {
        return this.wires[id];
    }

    stats() {
        return {
            nodeCount: this.wires.length,
            cacheSize: this.cache.size
        };
    }
}
