import fs from 'fs';
import path from 'path';
import { parseDSL } from '../dsl/parser.mjs';
import { UbhnlError, E_DSL_CIRCULAR_LOAD, E_INTERNAL_ERROR } from '../utils/errors.mjs';
import * as AST from '../dsl/ast.mjs';

export class TheoryLoader {
    constructor(session) {
        this.session = session;
        this.loadedDocs = new Map(); // absPath -> docId
        this.loadingStack = new Set(); // absPath
    }

    async loadFile(filePath) {
        const absPath = path.resolve(filePath);
        
        if (this.loadingStack.has(absPath)) {
            throw new UbhnlError(E_DSL_CIRCULAR_LOAD, `Circular dependency: ${absPath}`, 'TheoryFile');
        }

        if (this.loadedDocs.has(absPath)) {
            return this.loadedDocs.get(absPath);
        }

        this.loadingStack.add(absPath);

        try {
            const content = await fs.promises.readFile(absPath, 'utf-8');
            const docId = path.basename(absPath); // Simple ID for now
            
            // Parse
            const program = parseDSL(content, docId);

            // Process imports first (depth-first)
            // TODO: Extract `load` directives from AST (not yet in Parser)
            
            // Process declarations
            for (const stmt of program) {
                if (stmt instanceof AST.VocabularyBlock) {
                    this._processVocab(stmt);
                }
                // Assert/Check are processed by Session, or we store them here?
                // Session usually accumulates knowledge.
            }

            this.loadedDocs.set(absPath, docId);
            return docId;
        } catch (e) {
            if (e.code === 'ENOENT') {
                throw new UbhnlError(E_INTERNAL_ERROR, `File not found: ${absPath}`, 'TheoryFile');
            }
            throw e;
        } finally {
            this.loadingStack.delete(absPath);
        }
    }

    _processVocab(block) {
        for (const decl of block.declarations) {
            if (decl.kind === 'Domain') this.session.vocab.addDomain(decl.args[0]);
            if (decl.kind === 'Const') this.session.vocab.addConst(decl.args[0], decl.args[1]);
            // TODO: Pred/Func support in Parser needed to be robust here
        }
    }
}
