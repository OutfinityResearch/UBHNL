export class Kernel {
    constructor(options = {}) {
        const { enableHashCons = true } = options;
        this.enableHashCons = enableHashCons;
        this.nodes = [];
        this.nodeMap = enableHashCons ? new Map() : null;
        this.reused = 0;
        this._const1 = null;
    }

    addNode(op, args) {
        if (!op || !Array.isArray(args)) {
            throw new Error('Kernel.addNode expects (op, args[])');
        }
        if (this.nodeMap) {
            const key = `${op}|${JSON.stringify(args)}`;
            const existing = this.nodeMap.get(key);
            if (existing !== undefined) {
                this.reused += 1;
                return existing;
            }
            const id = this.nodes.length;
            this.nodes.push({ op, args });
            this.nodeMap.set(key, id);
            return id;
        }

        const id = this.nodes.length;
        this.nodes.push({ op, args });
        return id;
    }

    addAtom(name) {
        if (!name) throw new Error('Kernel.addAtom expects a name');
        return this.addNode('Atom', [name]);
    }

    const1() {
        if (this._const1 !== null) return this._const1;
        this._const1 = this.addNode('CONST1', []);
        return this._const1;
    }

    const0() {
        const one = this.const1();
        return this.xor(one, one);
    }

    xor(a, b) {
        return this.addNode('XOR', [a, b]);
    }

    and(a, b) {
        return this.addNode('AND', [a, b]);
    }

    var(key) {
        if (!key) throw new Error('Kernel.var expects a key');
        return this.addNode('VAR', [key]);
    }

    count() {
        return this.nodes.length;
    }

    stats() {
        return {
            nodes: this.nodes.length,
            reused: this.reused
        };
    }
}
