# UBH Core Specification

## 1. Scope
UBH (Universal Boolean Hypergraph) defines a minimal kernel for representing and reasoning about Boolean constraints using a directed hypergraph of XOR/AND/CONST operations over GF(2). All higher-level logics (FOL, lambda, temporal, probabilistic) are compiled into this kernel as front-ends.

## 2. Core Data Model
### 2.1 Nodes (Wires)
- Each wire is a Boolean variable with value in {0,1}.
- Wires are identified by stable integer IDs.

### 2.2 Gate Types
Required gate constructors:
- CONST0
- CONST1
- VAR (named input wire)
- XOR(a, b)
- AND(a, b)

Derived:
- NOT(x) := XOR(CONST1, x)
- OR(x, y) := XOR(XOR(x, y), AND(x, y))

### 2.3 Hypergraph
- The representation is a DAG of gates (hash-consed).
- Identical gates MUST be deduplicated (same op and inputs) to maximize structural sharing.
- All gate creation is pure: no mutation of existing nodes.

## 3. Constraint Model
A theory is a set of constraints over wires:
- ASSERT1(w): w == 1
- ASSERT0(w): w == 0
- ASSERT_EQ(a, b): a == b (encoded as XOR(a, b) == 0)

Equations are polynomials in GF(2) set to 0.

## 4. Kernel API
Minimal async API (hosted as JS module, async-first):
- const0() -> id
- const1() -> id
- var(name) -> id
- xor(a, b) -> id
- and(a, b) -> id
- assert1(w)
- assert0(w)
- assertEq(a, b)
- solve() -> { status: "SAT" | "UNSAT", model?: Map<id, 0|1> }
- prove(phi) -> { status: "PROVED" | "DISPROVED", model?: Map<id, 0|1> }

prove(phi) is defined as solve(T && NOT(phi)).

## 5. Simplification Rules (Core)
Lightweight rewrites applied at creation time:
- XOR(x, 0) = x
- XOR(x, x) = 0
- AND(x, 0) = 0
- AND(x, 1) = x
- AND(x, x) = x
- NOT(x) = XOR(1, x)

These MUST NOT change satisfiability.

## 6. Solving Strategy
- Base SAT backend with Tseitin encoding for AND/XOR gates.
- XOR constraints are treated as linear equations over GF(2) with incremental Gaussian elimination.
- SAT decisions propagate into XOR; XOR propagation can force SAT assignments.

## 7. Proof and Diagnostics
- UNSAT should optionally return a minimal-ish unsat core (subset of constraints).
- If proof traces are supported, store DRAT or equivalent for external checking.

## 8. Front-end Integration Contract
Front-ends are responsible for:
- Defining data types as bitvectors or finite domains.
- Compiling high-level formulas to UBH gates/constraints.
- Implementing quantifiers via finite expansion or lazy instantiation (CEGAR).

## 9. CNL/NL Front-end Requirements
- A controlled natural language (CNL) layer produces a typed AST.
- A lexicon defines symbols, arities, and finite domains.
- The compiler must be deterministic; ambiguous parses are rejected.
- The AST lowers to the core logic (forall/exists/and/or/not/implies) before UBH compilation.

## 10. Non-Goals
- The kernel does not parse natural language.
- The kernel does not implement rich types beyond Bit.
- The kernel does not expose any solver-specific internal state.
