# Spec: src/session/loader.mjs

## Goal
Handle the recursive loading of theory files (`.sys2`). It manages the file I/O, recursion detection, and parsing coordination.

## Dependencies
- `fs` (Node.js built-in)
- `path` (Node.js built-in)
- `src/dsl/parser.mjs`
- `src/utils/errors.mjs`

## Public Exports

### Class `TheoryLoader`
- **Constructor**: `(session)` - needs reference to session to update vocab/store.

- **Methods**:
  - `loadFile(filePath)`: Promise<string> (returns docId)
    - Checks for circular dependencies.
    - Reads file.
    - Parses DSL.
    - Processes `load "..."` directives recursively.
    - Registers definitions in Session.

## Logic
- **Recursion Detection**: Keep a `Set<string>` of canonical paths currently being loaded (stack). Throw `E_DSL_CIRCULAR_LOAD` if cycle detected.
- **Caching**: Keep a `Map<path, docId>` of already loaded files to skip re-parsing.
- **Path Resolution**: Relative paths are resolved relative to the *current file's* directory.
