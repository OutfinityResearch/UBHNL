# Source File Plan

## Top Level
- package.json: node metadata and scripts
- src/index.mjs: CLI entrypoint (placeholder banner)

## Core Modules (planned)
- src/api/kernel.mjs: public async API (constructors, assertions, solve/prove)
- src/ir/node-store.mjs: node table, hash-consing, canonicalization
- src/ir/ops.mjs: op enums, helpers, simplification rules
- src/solver/engine.mjs: SAT + XOR integration loop
- src/solver/cnf.mjs: Tseitin encoding for AND gates (CNF side)
- src/solver/xor-linear.mjs: incremental Gaussian elimination
- src/frontend/logic/ast.mjs: typed core logic AST data types (DS-006)
- src/frontend/fol.mjs: finite-domain FOL compiler (optional module)
- src/frontend/cnl/lexer.mjs: CNL tokenizer
- src/frontend/cnl/parser.mjs: CNL parser to concrete syntax tree
- src/frontend/cnl/lexicon.mjs: lexicon loader and symbol validation
- src/frontend/cnl/typing.mjs: typed AST builder and type checker
- src/frontend/cnl/lowering.mjs: desugar to core logic AST
- src/frontend/dsl/parser.mjs: DSL parser (DS-008)
- src/frontend/compile.mjs: compile typed AST to UBH
- src/session/session.mjs: session layer (learn/query, schemas, holes, explanations)
- src/utils/id-map.mjs: stable id to metadata mapping (wireId ↔ predicate instance, origins)
- src/cli/ubh.mjs: command line wiring and I/O

## Dev Tests
- src/devtests/run.mjs: harness for developer tests
- src/devtests/core.mjs: kernel-level tests (XOR/AND, simplification, prove)
- src/devtests/solver.mjs: SAT/XOR integration tests
- src/devtests/cnl.mjs: CNL parsing and compilation tests
- src/devtests/dsl.mjs: DSL parsing and compilation tests
- src/devtests/session.mjs: learn/query end-to-end tests (holes + explanations)

## Docs
- docs/: narrative documentation in .html
- docs/specs/: detailed specs
- docs/specs/src/system-spec.md: system-level overview (CNL → DSL → UBH)
- docs/specs/src/implementation-plan.md: milestone-based implementation plan
- docs/gamp/: URS/FS/NFS and metrics dashboard
