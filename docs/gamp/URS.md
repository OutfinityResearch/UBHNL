# URS (User Requirements Specification)

## Purpose
Provide a minimal kernel that models and solves Boolean constraints using XOR/AND/CONST and exposes a stable async API, plus a session layer that supports deterministic learn/query from CNL/DSL.

## User Goals
- URS-001: Represent Boolean theories as circuits over GF(2).
- URS-002: Prove or refute queries via `SAT/UNSAT/UNKNOWN` with optional models/certificates.
- URS-003: Prefer auditability: accept results only with checkable witnesses/certificates; otherwise report `UNKNOWN`.
- URS-004: Compile higher-level logics into the same kernel.
- URS-005: Work incrementally in a session: `learn(...)` facts/rules, then `query(...)` for entailment, witness search (holes), and counterexamples.
- URS-006: Get explainable outputs (unsat cores / counterexample summaries) in the user vocabulary.

## Scope
- Kernel IR and solver integration.
- Front-end compilation contract (CNL/DSL → typed AST → UBH).
- Session orchestration (schema engine iterations, learn/query behavior).

## Out of Scope
- Industrial-scale performance tuning (backends are pluggable; correctness is enforced via checkable witnesses/certificates).
- Large-scale database or UI.
- Unrestricted natural language understanding (input is Controlled Natural Language by design).
