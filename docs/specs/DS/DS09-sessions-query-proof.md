# DS-009: Sessions, Theory Store, Learn/Query, Witnesses, Explainability

## Goal
Specify the user-facing layer that:
- loads **theory files** (long-term memory) written in DSL/CNL,
- maintains a **session** (short-term working memory),
- runs queries via the orchestrator (fragments/backends/tactics),
- returns witnesses for existential queries,
- and produces explanations tied to file origins.

This DS defines behavior and data contracts; solver internals are covered by DS-010/011/012 and UBH-SPEC.

## Long-term vs Short-term Memory
### Long-term memory: Theory files
Theory files are plain text files on disk, typically stored as:
- `*.sys2` (DS-008) **canonical storage**
- `*.cnl` (DS-005) for authoring only (translated to `.sys2` before persistence)

Properties:
- managed by the user (git, filesystem),
- reproducible: loading the same set of files yields the same semantic IR,
- strict vocabulary: unknown bare identifiers are load errors (DS-008/DS-005).

### Short-term memory: Session
A session is an **ephemeral workspace** that:
- loads one or more theory files,
- accepts additional transient `learn(...)` statements,
- caches compilations and backend state across queries,
- can be discarded and reconstructed from theory files.

Rule: sessions are not the persistence mechanism; files are.

## Core Data Model
### Origin
Every learned/loaded statement must carry an `Origin`:
`Origin = ⟨sourceId, path?, line?, column?, snippet?, kind⟩`

Where `kind ∈ {DSL, CNL, API}`.

Origins are used for:
- unsat cores (by origin),
- proof explanations,
- debugging “why is this inconsistent?”.

### TheoryDoc
`TheoryDoc = ⟨docId, path, format, digest, vocabRefs, statements⟩`

Where:
- `digest` is a content hash used for caching and reproducibility.
- `statements` are typed semantic IR nodes with attached origins.
- `vocabRefs` are exported declarations from loaded CNL/DSL files.

### SessionState
`SessionState = ⟨vocab, loadedDocs[], deltaStatements[], caches⟩`

Where:
- `loadedDocs` are the long-term theories currently active,
- `deltaStatements` are transient session-only learns,
- `caches` include:
  - parsed/typed IR caches,
  - lowered fragment caches,
  - backend incremental state (when supported).

## Public API (Conceptual)
This is system-level behavior; the concrete JS API may differ.

### Load Theory Files
```
loadTheoryFile(path: string) -> { ok: true, docId } | { ok: false, error }
unloadTheoryFile(docId) -> ok
listLoadedTheories() -> TheoryDocSummary[]
```

Loading responsibilities:
- parse + typecheck using the session vocabulary,
- reject unknown vocabulary symbols,
- produce typed semantic IR with origins,
- register doc digest for caching.
- evaluate any `Check` statements (see DS-008/DS-005);
  - if a check is `DISPROVED`, return `E_CHECK_DISPROVED`,
  - if a check is `UNKNOWN`, return `E_CHECK_UNKNOWN`.

### Learn (session-only)
```
learn(input: string|AST, origin?: Origin) -> LearnResult
```
Learn responsibilities:
- parse + typecheck like file loading,
- add statements to `deltaStatements`,
- invalidate/update relevant caches incrementally.
- evaluate any `Check` statements in the learned input with the same policy as loading.

### Query
```
query(input: string|AST, kind: GoalKind, options?) -> QueryResult
```
Query responsibilities:
- parse + typecheck (if text input),
- normalize into `Problem` (DS-010),
- call the orchestrator (DS-012),
- require checkable witness/certificate (DS-011),
- return:
  - normalized status,
  - witness assignments (when the query introduces existential binders),
  - explanation payload with origins.

### Explain
```
explain(result: QueryResult, style?: "CNL"|"DSL"|"debug") -> string
```

## GoalKinds (Supported at Session Level)
Sessions expose the goal kinds defined in DS-010:
- `Satisfy`, `Prove`, `Refute`, `EnumerateModels`, `CountModels`, `Optimize`, `Synthesize`, `Explain`.

Not every loaded theory enables every goal kind; the planner decides applicability by fragments/backends.

## Witness Variables (Existential Queries) — Meaning and Contract
Witnesses are returned for queries that introduce **existential binders**.

### How witness variables are introduced
- **CNL (DS-005)**: witness queries use an interrogative form ending in `?`, e.g. `Which Person $p has fever?`.
- **DSL (DS-008)**: witness queries are expressed as an `Exists ... graph v ... end` block.

Sys2 DSL has no special `?` token: the **binder variable** `v` introduced by `Exists ... graph v` is the witness variable.

### Witness typing
Each witness variable must have a declared type/domain:
- in CNL, the type is explicit in the query header (e.g., `Which Person $p ... ?`);
- in DSL, the type is explicit in `Exists TypeName graph v`.

If the type cannot be determined deterministically: load error.

### Witness results
A successful query returns a `witnessAssignments` map:
`v -> value`

Value kinds depend on fragments:
- finite-domain witness (a vocabulary constant),
- boolean witness,
- bitvector/int witness (decoded from solver model),
- structured synthesis output (only if the chosen tactic/backends support it).

### Multiple solutions
When multiple witnesses exist:
- default: return one witness from the first accepted checkable model (deterministic selection policy),
- optional: allow enumeration with budgets (`EnumerateModels`) or a bounded list.

## Explainability Contracts
The system must be able to explain results in terms of user vocabulary and file origins.

### For `Prove` (entailment)
Implementation pattern:
- solve `T ∧ ¬φ`
- accept `PROVED` only if `UNSAT` is checkable (certificate or confirmed).

Explanation payload should include:
- origin-level unsat core when available,
- instantiated schema cases (if DS-004/CEGAR was used),
- a short narrative (“from these rules, contradiction with ¬φ”).

### For `Refute`
Return a counterexample witness (model or trace) that is checkable.
Explanation payload should include:
- the valuation/trace,
- the subset of atoms relevant to `φ` (best-effort),
- links back to origins that allowed the counterexample.

### For `Satisfy`
Return a model; explain by listing relevant derived/ground facts.

### For `Optimize`
Return:
- witness solution,
- proof of optimality (or `UNKNOWN` if not checkable),
- optionally a “why this is optimal” summary referencing bound certificates.

### For `CountModels` / `WMC`
Return:
- exact count with certificate (prefer KC-based) **or**
- approximate count with confidence parameters and audit metadata.

## Interaction with Fragments and Planner
The session does not “just call UBH”.

Instead:
1) session builds the combined theory `T = loadedDocs + deltaStatements`,
2) session normalizes the query into a `Problem` (DS-010),
3) orchestrator plans and runs backends (DS-012),
4) checkers validate artifacts (DS-011),
5) session formats the final answer + explanation.

## Example (Long-term files + short session)
Files on disk:
- `bio.sys2`:
  ```
  Vocab
      Domain Cell
      Const c0 Cell
      Const c1 Cell
  end

  @rule1:GeneAImpliesProteinP ForAll Cell graph c
      @g geneA $c
      @p proteinP $c
      @imp Implies $g $p
      return $imp
  end
  Assert GeneAImpliesProteinP

  @f1 geneA c0
  ```

Session flow:
1) `loadTheoryFile("bio.sys2")`
2) `query("proteinP c0", kind="Prove")`

Expected:
- `PROVED`
- explanation points to:
  - the quantified rule origin in `bio.sys2`,
  - the fact `@f1 geneA c0`.

Query with witness:
- `query("Which Cell $c has protein P?", kind="Satisfy")`

Expected:
- `SAT`
- `witnessAssignments: { c: c0 }` (one possible witness)
