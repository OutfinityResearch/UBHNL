# Source File Plan

## Top Level
- package.json: node metadata and scripts
- src/index.mjs: CLI entrypoint

## Core Modules (planned)
- src/api/kernel.mjs: public async API (constructors, assertions, solve/prove)
- src/ir/node-store.mjs: node table, hash-consing, canonicalization
- src/ir/ops.mjs: op enums, helpers, simplification rules
- src/solver/engine.mjs: SAT + XOR integration loop
- src/solver/cnf.mjs: Tseitin encoding for AND/XOR
- src/solver/xor-linear.mjs: incremental Gaussian elimination
- src/frontend/fol.mjs: finite-domain FOL compiler
- src/frontend/cnl/lexer.mjs: CNL tokenizer
- src/frontend/cnl/parser.mjs: CNL parser to concrete syntax tree
- src/frontend/cnl/lexicon.mjs: lexicon loader and symbol validation
- src/frontend/cnl/typing.mjs: typed AST builder and type checker
- src/frontend/cnl/lowering.mjs: desugar to core logic AST
- src/frontend/compile.mjs: compile typed AST to UBH
- src/utils/id-map.mjs: stable id to metadata mapping
- src/cli/ubh.mjs: command line wiring and I/O

## Dev Tests
- src/devtests/run.mjs: harness for developer tests
- src/devtests/core.mjs: kernel-level tests (XOR/AND, simplification, prove)
- src/devtests/solver.mjs: SAT/XOR integration tests
- src/devtests/cnl.mjs: CNL parsing and compilation tests

## Docs
- docs/: narrative documentation in .jhtml
- docs/specs/: detailed specs
- docs/gamp/: URS/FS/NFS and metrics dashboard
