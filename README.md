# UBHNL

A prototype for an UBH (Universal Boolean Hypergraph) kernel + CNL/DSL front-end.

## Status

This repository is currently documentation-first. The code is a scaffold; the specs are the source of truth.

## Languages

UBHNL supports two isomorphic input languages:

| Language | Extension | Purpose |
|----------|-----------|---------|
| **CNL** (Controlled Natural Language) | `.cnl` | Human-friendly authoring |
| **DSL** (sys2) | `.sys2` | Machine-friendly storage |

Both compile to the same typed AST and can be translated bidirectionally.

## Docs

- **Vision**: `docs/specs/DS/DS00-vision.md`
- **System spec**: `docs/specs/src/system-spec.md`
- **Design specs**: `docs/specs/DS/` (DS00-DS19)
- **Implementation plan**: `docs/specs/src/implementation-plan.md`
- **Test plan**: `docs/specs/tests/test-plan.md`

## Quick Example

**CNL** (natural language):
```cnl
Ion is a Person.
Ion has fever.

For all Person p: if p has flu then p has fever.

Which Person p has fever?
```

**DSL** (programming style):
```sys2
@ion:Person
@ion has_fever

forall $p in Person: has_flu($p) implies has_fever($p)

exists ?p in Person: has_fever(?p)
```

## Run

```bash
npm run start     # Run main
npm run devtest   # Run tests
```

## Specification Index

| Spec | Title |
|------|-------|
| DS00 | Vision and Core Specification |
| DS01 | IR and Hash-Consing |
| DS02 | Solver Interface (SAT+XOR) |
| DS03 | Front-end Compilation |
| DS04 | Schema Engine (CEGAR) |
| DS05 | CNL and Lexicon |
| DS06 | NL Pipeline |
| DS07 | Typed Logic → UBH Compilation |
| DS08 | DSL (sys2) Format |
| DS09 | Sessions (learn/query/explain) |
| DS10 | Fragments and Goal Kinds |
| DS11 | Backends and Certificates |
| DS12 | Orchestrator/Planner |
| DS13 | Probabilistic Reasoning |
| DS14 | Certificate Formats |
| DS15 | GAMP Traceability |
| DS16 | Error Handling |
| DS17 | Universal CNL Extensions |
| DS18 | CNL ↔ DSL Translator |
| DS19 | Keywords and Operators |
