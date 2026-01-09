import { Vocabulary } from './vocab.mjs';
import { TheoryLoader } from './loader.mjs';
import { WireStore } from '../kernel/store.mjs';
import { parseDSL } from '../dsl/parser.mjs';

export class Session {
    constructor() {
        this.vocab = new Vocabulary();
        this.store = new WireStore();
        this.loader = new TheoryLoader(this);
        this.assertions = [];
    }

    async load(filePath) {
        return this.loader.loadFile(filePath);
    }

    learn(source) {
        const program = parseDSL(source, 'interactive');
        // Simple processing
        for (const stmt of program) {
            if (stmt.type === 'VocabularyBlock') {
                this.loader._processVocab(stmt);
            } else if (stmt.type === 'Assert') {
                this.assertions.push(stmt.expr);
            }
        }
    }

    async query(source, kind = 'Satisfy') {
        // Placeholder query implementation
        // 1. Parse query
        // 2. Check vocab
        // 3. (Future) Solve
        return { status: 'UNKNOWN', message: 'Solver not yet implemented' };
    }

    reset() {
        this.vocab = new Vocabulary();
        this.store = new WireStore();
        this.loader = new TheoryLoader(this);
        this.assertions = [];
    }
}
