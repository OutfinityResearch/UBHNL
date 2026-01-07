# DS-007: Compile Typed Logic to UBH

## Goal
Define how typed logical ASTs from CNL are compiled into UBH wires and constraints.

## Scope
This DS defines compilation from the **typed core logic AST** (DS-006) into:
- UBH node ids (wires) via `xor/and/const/var`, and
- kernel constraints via `assert0/1/eq`.

The compilation target is intentionally tiny. Everything else (sessions, schemas, proofs) is layered above.

## Decisions
- All CNL/DSL types are lowered by **explicit enumeration** before UBH compilation (DS-003).
- Predicates become indexed Boolean wires keyed by concrete arguments.
- Quantifiers use:
  - finite expansion for small domains, or
  - schema emission for large domains (CEGAR, DS-004).

## Finite Domain Encoding (Normative)
For the CNL/DSL pipeline, **no bitvector encoding is used** for finite domains:
- Each domain element is a declared constant (`@c0:c0 __Atom`, `IsA c0 Cell`).
- Quantifiers expand by **enumerating** domain elements (or emit a schema object).
- Equality on domain elements is **syntactic** equality of constants.

If a different front-end uses bitvectors, it must provide its own lowering rules and
domain constraints; that is outside this DS.

## Compilation Rules
### Boolean Operators
All operators must lower to `{XOR, AND, CONST1}` (kernel basis):
- `Not(a)` → `xor(CONST1, a)`
- `Or(a,b)` → `xor(xor(a,b), and(a,b))`
- `And(a,b)` → `and(a,b)`
- `Implies(a,b)` → `Or(Not(a), b)`

Compilation returns a UBH wire id for the resulting Boolean expression.

### Predicates
`Pred(name, args)` maps to a **VAR wire** uniquely determined by `(name, args)` where each arg is a concrete constant.

Type checking is enforced before compilation:
- predicate arity must match,
- each argument must be a declared constant of the expected type.

### Quantifiers (Expansion Semantics)
Let `Body(d)` denote the body with the quantified variable substituted by concrete element `d`.
- `ForAll(x in D, body)` expands to `AND_{d∈D} compile(Body(d))`
  - if `D` is empty: returns `CONST1`
- `Exists(x in D, body)` expands to `OR_{d∈D} compile(Body(d))`
  - if `D` is empty: returns `CONST0`

For large domains, see “Schema Engine Hook”.

## Symbol Table
The symbol table is responsible for stable naming/mapping.

### Predicate Instance Keying
Normative approach:
- Canonical key string: `P(arg0,arg1,...,argN-1)` using **KB names** for constants.
- The compiler calls `kernel.var(key)` to obtain a stable wire id.
- The session maintains a reverse map `wireId -> (P, args[])` for explanation/counterexample rendering.

Additional rules:
- The symbol table is **session-global** and deterministic: the same key always maps to the same wire id.
- Keys are interned on first use; subsequent uses must reuse the same id.
- Any attempt to map the same key to different metadata is a hard error.

If two predicates share the same name but different arities/types, that is a vocabulary
error and must be rejected before reaching this stage.

This avoids having to pre-allocate a dense “wire grid” while still guaranteeing stability.

## Schema Engine Hook
For large domains, full expansion is avoided by emitting schema objects (DS-004).

### Policy
Compilation is parameterized by a policy:
- `ExpandQuantifiers(maxDomainSize=N)`:
  - expand if `|D| ≤ N`, else emit schema.
- `AlwaysExpand` (devtests / tiny domains)
- `AlwaysSchema` (stress-testing schema engine)

### Emitted Schema Object (Conceptual)
For a universal:
`forall x in D: body`

Emit:
- `Schema(kind="forall", var=x, domain=D, body=bodyAst, origin=sourceSpan)`

The schema engine then instantiates concrete `body(d)` only when a model violates it.

Note: schemas should appear at statement boundaries (`learn` rules/axioms), not as sub-expressions inside arbitrary Boolean formulas, unless the front-end first rewrites them into an equivalent boundary form.

## Rationale
This preserves a small kernel while enabling rich logic and NL-driven input.

## Example (End-to-End Shape)
Vocabulary:
- `Cell = {c0,c1}`
- predicates: `geneA(Cell)`, `proteinP(Cell)`

Statement:
`forall c in Cell: geneA(c) implies proteinP(c)`

Expansion:
1) `geneA(c0) -> proteinP(c0)` compiled to `assert1(phi0)`
2) `geneA(c1) -> proteinP(c1)` compiled to `assert1(phi1)`

Each predicate instance becomes a `VAR` wire:
- `var("geneA(c0)")`, `var("proteinP(c0)")`, ...
