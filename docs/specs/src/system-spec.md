# UBHNL System Specification (Universal Reasoning, UBH-centric)

## 0) Objective and Principles
UBHNL specifies a universal reasoning system that can:
- `learn`: load theories and add incremental knowledge,
- `query`: answer satisfiability / entailment / synthesis / counting / optimization goals,
- produce **checkable** results (witnesses/certificates),
- and return **explanations** (proof summaries or counterexamples) in user vocabulary (CNL/DSL).

Core principles:
- **Minimal kernel**: keep the trusted core small (UBH + checkers).
- **Everything else is modular**: backends, tactics, and front-ends are replaceable modules.
- **Determinism**: parsing/typing and symbol resolution are deterministic; unknown vocabulary symbols are load errors.
- **Auditability**: every accepted result is checkable (or explicitly marked heuristic/unknown).
- **Incrementality**: sessions cache compiled artifacts and reuse solver state when possible.

## 1) Reading Order (Specs)
Start here, then:
- Kernel core: `docs/specs/UBH-SPEC.md`
- Core DS: `docs/specs/DS/`
  - IR + hash-consing: `docs/specs/DS/001-ir-hashcons.md`
  - UBH solving (SAT+XOR): `docs/specs/DS/002-solver-xor.md`
  - Front-end compilation: `docs/specs/DS/003-frontends-compile.md`
  - Schema engine (CEGAR-style): `docs/specs/DS/004-schema-engine.md`
  - CNL + lexicon: `docs/specs/DS/005-cnl-lexicon.md`
  - NL pipeline to typed IR: `docs/specs/DS/006-nl-pipeline.md`
  - Typed logic → UBH compilation: `docs/specs/DS/007-nl-ubh-compile.md`
  - DSL (authoring + canonical IR): `docs/specs/DS/008-dsl.md`
  - Sessions (learn/query/explain): `docs/specs/DS/009-sessions-query-proof.md`
  - Fragments + goal kinds: `docs/specs/DS/010-fragments-goals.md`
  - Backends + certificates: `docs/specs/DS/011-backends-certificates.md`
  - Orchestrator/planner: `docs/specs/DS/012-orchestrator-planner.md`

## 2) System Layers and Contracts
### 2.1 Layer 1 — Trusted Core (UBH + Checkers)
Specs:
- `docs/specs/UBH-SPEC.md`
- `docs/specs/DS/011-backends-certificates.md`

Responsibilities:
- UBH IR creation (hash-consed Boolean DAG) and constraint storage.
- UBH evaluation (check SAT witnesses).
- Proof/certificate checking (SAT DRAT/LRAT, and other checker modules).

Non-responsibilities:
- parsing CNL/DSL,
- domain typing (beyond `Bit` inside UBH),
- query planning/orchestration,
- heuristic search.

### 2.2 Layer 2 — Front-Ends (CNL/DSL → Typed Semantic IR)
Specs:
- `docs/specs/DS/005-cnl-lexicon.md`
- `docs/specs/DS/006-nl-pipeline.md`
- `docs/specs/DS/008-dsl.md`

Responsibilities:
- deterministic parsing, typing, and symbol resolution,
- strict vocabulary policy (unknown bare identifiers are load errors),
- lowering to a typed semantic IR suitable for fragment classification (DS-010).

### 2.3 Layer 3 — Orchestrator (Fragments/Backends/Tactics)
Specs:
- `docs/specs/DS/010-fragments-goals.md`
- `docs/specs/DS/011-backends-certificates.md`
- `docs/specs/DS/012-orchestrator-planner.md`

Responsibilities:
- classify problems into fragments + goal kinds,
- build and execute a plan DAG of tasks,
- run backends with budgets/timeouts,
- accept results only if checkable (or return `UNKNOWN`),
- manage cross-backend artifacts (lemmas, invariants, cores),
- produce explanation payloads.

### 2.4 Layer 4 — Session + Theory Store (Short-term vs Long-term Memory)
Spec:
- `docs/specs/DS/009-sessions-query-proof.md`

Roles:
- **Theory files** (long-term memory): CNL/DSL files on disk that define reusable vocabularies, axioms, and rules.
- **Session** (short-term memory): a working set that loads one or more theory files plus transient user additions and caches.

## 3) End-to-End Data Flow (CNL/DSL → Result)
ASCII overview:
```
           theory files (CNL/DSL)     query (CNL/DSL)
                    │                     │
                    ├──── parse/type ─────┤
                    │                     │
                    ▼                     ▼
             typed semantic IR       typed semantic IR
                    │                     │
                    └───────┬─────────────┘
                            ▼
                     fragment detection
                            ▼
                      plan DAG (tasks)
                            ▼
      backends (SAT/SMT/QBF/MC/… ) + certificate checkers
                            ▼
                 result + witness/cert + explanation
```

## 4) Fragment System and Goal Kinds
The system must explicitly model:
- `GoalKind` (what the user wants),
- `Fragment` (what constraints are involved),
as defined in `docs/specs/DS/010-fragments-goals.md`.

## 5) Backend Catalog and Certificates
Backends and certificates are specified in:
- `docs/specs/DS/011-backends-certificates.md`

Key rule:
- `SAT/UNSAT/OPTIMAL` claims must be accepted only with a checkable witness/certificate, or after confirmation by a checkable route.

## 6) Mapping to UBH (What Lowers, What Stays Native)
UBH is the system’s bit-level substrate and checker anchor.

Guidelines (planner-controlled):
- Lower to UBH/SAT when constraints are finite and bit-precise (BV, finite domains, bounded TS, many GF(2) polynomials).
- Keep native backends for continuous/numeric theories (NRA, SDP) and demand checkable certificates.
- For quantified fragments (QBF/CHC/TS), prefer native solvers plus invariant/strategy certificates; optionally lower bounded instances.

## 7) Learn / Query / Explain (User-Facing Contract)
### 7.1 Learn
`learn(input: CNL|DSL|AST, origin) -> LearnResult`

Learn must:
- reject unknown vocabulary symbols (unless declared/exported),
- attach `originId` to emitted constraints/schemas,
- update session caches incrementally.

### 7.2 Query
`query(input: CNL|DSL|AST, kind: GoalKind, options) -> QueryResult`

Query must support:
- entailment (`Prove`) via `T ∧ ¬φ`,
- refutation (`Refute`) via counterexample model/trace,
- hole filling (`exists ?x in D: ...`) returning witnesses,
- counting/optimization/synthesis via fragments/backends.

### 7.3 Explain
`explain(result) -> CNL/DSL explanation`

Explanation must:
- refer to user vocabulary and theory origins,
- include minimal-ish unsat cores when available,
- include counterexample summaries when disproved.

## 8) Fragment × Backend × Certificate Matrix (Minimal)
This table is intentionally “minimum coherent”; more rows are defined by DS-010/011.

| Fragment | GoalKinds | Primary backend(s) | Typical lowering | Checkable artifact |
|---|---|---|---|---|
| `Frag_UBH` | satisfy/prove/refute | SAT+XOR | native | model / DRAT-LRAT |
| `Frag_SAT_CNF` | satisfy/prove/refute | CDCL SAT | none | model / DRAT-LRAT |
| `Frag_QBF` | satisfy/prove/refute | QCDCL/CEGAR | bounded→SAT | strategy / Q-resolution |
| `Frag_SMT_BV` | satisfy/prove/refute | SMT(BV) | bit-blast→UBH | model / proof or SAT cert |
| `Frag_TS` | prove/refute | IC3/PDR, BMC | BMC→UBH | invariant / trace |
| `Frag_CHC` | prove/synthesize | CHC solvers | reduce→SMT | invariant/model |
| `Frag_Opt` | optimize | MaxSAT/PBO/OMT | to SAT/SMT/MIP | witness + bound proof |
| `Frag_Count/WMC` | count | KC / hashing | to KC | exact: KC proof; approx: audit |
| `Frag_MIP` | satisfy/optimize | branch-and-cut | none | primal+dual cert |
| `Frag_SDP_SOS` | prove/optimize | SDP/SOS | none | dual/SOS cert |

## 9) Required End-to-End Examples
These examples are normative: they define what “works” means at the system level.

### Example 1 — Propositional / UBH-native (SAT)
Vocabulary:
- predicates: `A()`, `B()`, `C()` (nullary booleans)

Learn (DSL, asserted statements):
```
A() implies C()
B() implies C()
```
(Any equivalent DSL/CNL form is acceptable; the compiler lowers to UBH.)

Query:
`Prove: (A() and B()) implies C()`

Expected:
- result: `PROVED`
- certificate: `UNSAT` certificate for `T ∧ ¬φ` (DRAT/LRAT or equivalent)
- explanation: core references the two implications.

### Example 2 — SMT(BitVector) (bit-blast or SMT proof)
Vocabulary:
- bitvector variables: `x:BV8`, `y:BV8`

Note:
- This example assumes an SMT-capable frontend (e.g., SMT-LIB adapter or a BV DSL extension) that produces typed semantic IR in `Frag_SMT_BV`.

Learn:
- `x + 1 = y`
- `x = 255`

Query:
- `Prove: y = 0` (mod 256)

Expected:
- result: `PROVED`
- certificate:
  - either an SMT proof object, or
  - bit-blast to UBH/SAT + DRAT/LRAT.

### Example 3 — Transition System Safety (IC3/PDR or BMC)
System:
- state `s:BV2`
- init: `s = 0`
- trans: `s' = s + 1 mod 4`
- safety: `s != 3`

Note:
- This example assumes a TS frontend that produces a `Frag_TS` model (init/trans/safety), possibly reusing BV expressions from `Frag_SMT_BV`.

Query:
`Prove: Always(s != 3)`

Expected:
- result: `DISPROVED`
- counterexample trace: `s=0 → 1 → 2 → 3` (length 3)
- trace is checkable by evaluating the transition relation.

## 10) Implementation Notes
Implementation phases are tracked in:
- `docs/specs/src/implementation-plan.md`

The plan is free to deliver modules incrementally, but the **spec contracts above are stable**:
- no silent weakening of determinism,
- no acceptance of uncheckable UNSAT/OPTIMAL claims.
