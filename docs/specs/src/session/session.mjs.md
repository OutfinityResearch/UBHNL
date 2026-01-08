# Spec: src/session/session.mjs

## Goal
The high-level API for the interactive CLI. It ties together the Kernel, Vocabulary, and Loader.

## Dependencies
- `src/kernel/store.mjs`
- `src/session/vocab.mjs`
- `src/session/loader.mjs`
- `src/dsl/parser.mjs` (for interactive `learn`)

## Public Exports

### Class `Session`
- **Constructor**: `()`
  - `this.vocab = new Vocabulary()`
  - `this.store = new WireStore()`
  - `this.loader = new TheoryLoader(this)`

- **Methods**:
  - `load(path)` -> delegates to `loader.loadFile`.
  - `learn(source)` -> parses string, updates vocab, (future) compiles to kernel.
  - `query(source)` -> parses query, checks vocab, (future) runs solver.
  - `reset()` -> clears state (creates new instances).

## Logic
- Acts as the "Controller" in MVC terms.
- Maintains the "Short-term memory" (learned facts that aren't in files).
