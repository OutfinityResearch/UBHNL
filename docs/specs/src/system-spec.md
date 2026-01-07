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

Start with the vision document, then proceed through the specifications:

### Core Vision and Kernel
- **DS00-vision.md** - Project vision and UBH core specification

### Boolean Kernel (Trusted Core)
- **DS01-ir-hashcons.md** - IR and hash-consing
- **DS02-solver-xor.md** - Solver interface and XOR handling

### Front-end Compilation
- **DS03-frontends-compile.md** - Front-end compilation contract
- **DS04-schema-engine.md** - Schema engine (CEGAR-style)

### Languages (CNL ↔ DSL)
- **DS05-cnl-lexicon.md** - Controlled Natural Language and Lexicon
- **DS06-nl-pipeline.md** - NL pipeline to typed IR
- **DS07-nl-ubh-compile.md** - Typed logic → UBH compilation
- **DS08-dsl.md** - DSL (sys2) authoring format
- **DS18-cnl-translator.md** - CNL ↔ DSL bidirectional translator
- **DS19-sys2-std-lib.md** - Reserved keywords and operators

### Sessions and Orchestration
- **DS09-sessions-query-proof.md** - Sessions (learn/query/explain)
- **DS10-fragments-goals.md** - Fragments and goal kinds
- **DS11-backends-certificates.md** - Backends and certificates
- **DS12-orchestrator-planner.md** - Orchestrator/planner

### Advanced Features
- **DS13-probabilistic-engine.md** - Probabilistic reasoning (WMC/KC)
- **DS17-universal-cnl.md** - Universal CNL extensions

### Quality and Operations
- **DS14-certificate-formats-verification.md** - Certificate formats
- **DS15-gamp-traceability.md** - GAMP traceability matrix
- **DS16-error-handling-diagnostics.md** - Error handling and diagnostics

## 2) System Layers and Contracts

### 2.1 Layer 1 — Trusted Core (UBH + Checkers)

Specs:
- `DS00-vision.md` (Section 3-9)
- `DS11-backends-certificates.md`
- `DS14-certificate-formats-verification.md`

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
- `DS05-cnl-lexicon.md`
- `DS06-nl-pipeline.md`
- `DS08-dsl.md`
- `DS18-cnl-translator.md`

Responsibilities:
- deterministic parsing, typing, and symbol resolution,
- strict vocabulary policy (unknown bare identifiers are load errors),
- bidirectional CNL ↔ DSL translation,
- lowering to a typed semantic IR suitable for fragment classification.

### 2.3 Layer 3 — Orchestrator (Fragments/Backends/Tactics)

Specs:
- `DS10-fragments-goals.md`
- `DS11-backends-certificates.md`
- `DS12-orchestrator-planner.md`

Responsibilities:
- classify problems into fragments + goal kinds,
- build and execute a plan DAG of tasks,
- run backends with budgets/timeouts,
- accept results only if checkable (or return `UNKNOWN`),
- manage cross-backend artifacts (lemmas, invariants, cores),
- produce explanation payloads.

### 2.4 Layer 4 — Session + Theory Store (Short-term vs Long-term Memory)

Spec:
- `DS09-sessions-query-proof.md`

Roles:
- **Theory files** (long-term memory): canonical storage is DSL (`.sys2`); CNL is for authoring and is translated before persistence.
- **Session** (short-term memory): working set with loaded theories, transient additions, and caches.

## 3) End-to-End Data Flow (CNL/DSL → Result)

```
     CNL (.cnl)                    DSL (.sys2)
          │                             │
          ▼                             ▼
    ┌───────────┐                 ┌───────────┐
    │CNL Parser │◄───translate───►│DSL Parser │
    │  (DS05)   │     (DS18)      │  (DS08)   │
    └─────┬─────┘                 └─────┬─────┘
          │                             │
          └──────────┬──────────────────┘
                     ▼
           ┌───────────────────┐
           │  Typed Logic AST  │
           │      (DS06)       │
           └─────────┬─────────┘
                     ▼
           ┌───────────────────┐
           │ Fragment Detection│
           │      (DS10)       │
           └─────────┬─────────┘
                     ▼
           ┌───────────────────┐
           │   Plan DAG        │
           │   (DS12)          │
           └─────────┬─────────┘
                     ▼
    ┌────────────────┴────────────────┐
    │  Backends + Certificate Checkers │
    │         (DS11, DS14)             │
    └────────────────┬────────────────┘
                     ▼
           ┌───────────────────┐
           │ Result + Witness  │
           │ + Certificate     │
           │ + Explanation     │
           └───────────────────┘
```

## 4) Fragment System and Goal Kinds

The system must explicitly model:
- `GoalKind` (what the user wants),
- `Fragment` (what constraints are involved),
as defined in `DS10-fragments-goals.md`.

## 5) Backend Catalog and Certificates

Backends and certificates are specified in:
- `DS11-backends-certificates.md`
- `DS14-certificate-formats-verification.md`

Key rule:
- `SAT/UNSAT/OPTIMAL` claims must be accepted only with a checkable witness/certificate, or after confirmation by a checkable route.

## 6) Mapping to UBH (What Lowers, What Stays Native)

UBH is the system's bit-level substrate and checker anchor.

Guidelines (planner-controlled):
- Lower to UBH/SAT when constraints are finite and bit-precise.
- Keep native backends for continuous/numeric theories and demand checkable certificates.
- For quantified fragments, prefer native solvers plus certificates.

## 7) Learn / Query / Explain (User-Facing Contract)

### 7.1 Learn
```typescript
learn(input: CNL | DSL | AST, origin) -> LearnResult
```

Learn must:
- reject unknown vocabulary symbols (unless declared/exported),
- attach `originId` to emitted constraints/schemas,
- update session caches incrementally.

### 7.2 Query
```typescript
query(input: CNL | DSL | AST, kind: GoalKind, options) -> QueryResult
```

Query must support:
- entailment (`Prove`) via `T ∧ ¬φ`,
- refutation (`Refute`) via counterexample model/trace,
- witness queries (CNL `Which ...?`, DSL `Exists ... graph ... end`) returning witnesses,
- counting/optimization/synthesis via fragments/backends.

Error handling: see `DS16-error-handling-diagnostics.md`.

### 7.3 Explain
```typescript
explain(result) -> CNL | DSL explanation
```

Explanation must:
- refer to user vocabulary and theory origins,
- include minimal-ish unsat cores when available,
- include counterexample summaries when disproved.

## 8) Fragment × Backend × Certificate Matrix (Minimal)

| Fragment | GoalKinds | Primary backend(s) | Checkable artifact |
|----------|-----------|--------------------|--------------------|
| `Frag_UBH` | satisfy/prove/refute | SAT+XOR | model / DRAT-LRAT |
| `Frag_SAT_CNF` | satisfy/prove/refute | CDCL SAT | model / DRAT-LRAT |
| `Frag_QBF` | satisfy/prove/refute | QCDCL/CEGAR | strategy / Q-resolution |
| `Frag_SMT_BV` | satisfy/prove/refute | SMT(BV) | model / proof |
| `Frag_TS` | prove/refute | IC3/PDR, BMC | invariant / trace |
| `Frag_Opt` | optimize | MaxSAT/PBO/OMT | witness + bound proof |
| `Frag_Count/WMC` | count | KC / hashing | KC proof / audit |

## 9) Required End-to-End Examples

### Example 1 — Biology (CNL + DSL)

**CNL** (`biology.cnl`):
```cnl
c0 is a Cell.
c0 has gene A.

For any Cell c:
    If geneA($c) and not inhibitor($c) then proteinP($c).
```

**DSL** (`biology.sys2`):
```sys2
Vocab
    Domain Cell
    Const c0 Cell
end

@f1 geneA c0

@rule1:GeneAImpliesProteinP ForAll Cell graph c
    @g geneA $c
    @inh inhibitor $c
    @ninh Not $inh
    @prem And $g $ninh
    @p proteinP $c
    @imp Implies $prem $p
    return $imp
end
Assert GeneAImpliesProteinP
```

**Query**: Does c0 have protein P?

**Expected**:
- result: `PROVED`
- explanation: references the rule and fact

### Example 2 — Medical Diagnosis (CNL)

**CNL** (`diagnosis.cnl`):
```cnl
Ion is a Person.
Ion has flu.

For any Person p:
    If $p has flu then $p has fever.

Which Person $p has fever?
```

**Expected**:
- result: `SAT`
- witness assignment: `p = Ion`

### Example 3 — Contradiction Detection

**DSL** (`contradiction.sys2`):
```sys2
Vocab
    Domain Cell
    Const c0 Cell
end

@f1 geneA c0
@f2 inhibitor c0

@rule1:GeneAImpliesNotInhibitor ForAll Cell graph c
    @g geneA $c
    @inh inhibitor $c
    @ninh Not $inh
    @imp Implies $g $ninh
    return $imp
end
Assert GeneAImpliesNotInhibitor
```

**Expected**:
- result: `UNSAT`
- explanation: "c0 has geneA and inhibitor, but rule requires not inhibitor"

## 10) Implementation Notes

Implementation phases are tracked in:
- `docs/specs/src/implementation-plan.md`

The plan is free to deliver modules incrementally, but the **spec contracts above are stable**:
- no silent weakening of determinism,
- no acceptance of uncheckable UNSAT/OPTIMAL claims.
