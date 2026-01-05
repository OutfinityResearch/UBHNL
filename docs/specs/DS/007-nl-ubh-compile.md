# DS-007: Compile Typed Logic to UBH

## Goal
Define how typed logical ASTs from CNL are compiled into UBH wires and constraints.

## Decisions
- All types are lowered to finite domains (bitvectors or enumerations).
- Predicates become indexed Boolean wires keyed by arguments.
- Quantifiers use finite expansion or the schema engine (CEGAR).

## Compilation Rules
- And/Or/Not/Implies lower to XOR/AND/CONST.
- Pred(name, args) maps to a wire id resolved by symbol table.
- ForAll expands to conjunction of body instances.
- Exists expands to disjunction of body instances.

## Symbol Table
- For each predicate P with domain D1..Dn, allocate a wire grid.
- A concrete instance P(a, b) maps to a single wire id.

## Schema Engine Hook
- For large domains, emit schema nodes instead of expansion.
- Schema instances are generated on model counterexamples.

## Rationale
This preserves a small kernel while enabling rich logic and NL-driven input.
