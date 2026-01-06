# DS00: UBHNL Vision and Core Specification

## Vision Statement

**UBHNL** (Universal Boolean Hypergraph + Natural Language) is a **universal reasoning system** that enables:

1. **Natural language input**: Domain experts express knowledge in controlled natural language (CNL)
2. **Rigorous reasoning**: A minimal Boolean kernel provides sound, complete, and checkable reasoning
3. **Explainable results**: Proofs and counterexamples are presented in user vocabulary
4. **Auditability**: Every accepted result is backed by a checkable certificate

### The Core Insight

Many reasoning problems - from logic puzzles to medical diagnosis to hardware verification - ultimately reduce to Boolean satisfiability. UBHNL exploits this by:

1. Building a **minimal trusted kernel** (UBH) that operates on Boolean circuits with native XOR handling
2. **Compiling** higher-level logics (first-order, temporal, probabilistic) into UBH constraints
3. **Requiring checkable certificates** for all solver claims (no blind trust)
4. Providing **two isomorphic languages**: CNL for humans, DSL for machines

### Target Use Cases

| Domain | Example | UBHNL Approach |
|--------|---------|----------------|
| **Biology** | Gene regulation rules | CNL rules + entailment queries |
| **Medicine** | Diagnostic reasoning | Finite-domain FOL + explanations |
| **Hardware** | Circuit verification | Boolean circuits + BMC/IC3 |
| **Puzzles** | Sudoku, logic grids | Constraint propagation + SAT |
| **Compliance** | Regulatory checking | Rules as implications + audit trail |

---

## 1. Scope

UBH (Universal Boolean Hypergraph) defines a **minimal kernel** for:
- representing Boolean expressions as a hash-consed DAG of gates over `{0,1}`, and
- reasoning about Boolean constraints via `SAT/UNSAT/UNKNOWN` (with native XOR handling).

Everything above the kernel (CNL/DSL parsing, finite-domain FOL, temporal encodings, probabilistic layers) is specified as a *front-end* that compiles into UBH constraints.

**Non-goal**: UBH is not "a logic"; it is a minimal substrate for many logics.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
│  ┌─────────────┐                            ┌─────────────┐     │
│  │   CNL       │◄──── bidirectional ────────►│   DSL       │     │
│  │  (.cnl)     │      translation           │  (.sys2)    │     │
│  │  Human-     │      (DS-018)              │  Machine-   │     │
│  │  friendly   │                            │  friendly   │     │
│  └──────┬──────┘                            └──────┬──────┘     │
│         │                                          │             │
│         └──────────────────┬───────────────────────┘             │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    TYPED LOGIC AST                          │ │
│  │         ForAll, Exists, And, Or, Not, Implies, Pred         │ │
│  │                        (DS-006)                             │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
└────────────────────────────┼────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Fragment   │  │   Query     │  │   Backend   │              │
│  │  Detection  │  │   Planner   │  │   Dispatch  │              │
│  │  (DS-010)   │  │  (DS-012)   │  │  (DS-011)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       TRUSTED CORE                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      UBH KERNEL                              │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │ │
│  │  │Hash-Cons│  │ SAT+XOR │  │ Model   │  │ Cert    │        │ │
│  │  │  DAG    │  │ Solver  │  │ Checker │  │ Checker │        │ │
│  │  │(DS-001) │  │(DS-002) │  │         │  │(DS-014) │        │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Trust Level | Responsibility | Key Specs |
|-------|-------------|----------------|-----------|
| **User Interface** | Untrusted | Parse CNL/DSL, report errors | DS-005, DS-008 |
| **Typed AST** | Untrusted | Symbol resolution, type checking | DS-006 |
| **Orchestrator** | Untrusted | Planning, backend dispatch | DS-010, DS-011, DS-012 |
| **Trusted Core** | TRUSTED | Boolean reasoning, certificate checking | DS-001, DS-002, DS-014 |

---

## 3. Core Data Model

### 3.1 Nodes (Wires)
- Each wire is a Boolean variable with value in {0,1}.
- Wires are identified by stable integer IDs within a single kernel instance.

**Wire ID allocation**:
- ID 0 = CONST0
- ID 1 = CONST1
- IDs 2+ allocated sequentially for VARs and gates

Terminology note: "wire" and "node id" are used interchangeably. A node id denotes the output wire of either:
- a constant,
- an input variable, or
- a derived gate (XOR/AND) whose value is functionally determined by its inputs.

#### Bit vs Bool (front-end terminology)
UBH itself only knows **bits** (`{0,1}`).
Higher layers may distinguish:
- **Bool**: a single bit used as a logical proposition (e.g., a predicate instance like `proteinP(c0)`).
- **BVk bits**: bits that are part of an encoding of a larger value (bitvectors, enums, sets).

The distinction matters for explainability:
- Bool-level wires should be mapped back to user vocabulary (predicates/constants),
- encoding bits should be decoded into domain-level values before being shown to users.

### 3.2 Gate Types
Required gate constructors:
- CONST0
- CONST1
- VAR (named input wire)
- XOR(a, b)
- AND(a, b)

Derived:
- NOT(x) := XOR(CONST1, x)
- OR(x, y) := XOR(XOR(x, y), AND(x, y))

### 3.3 Hypergraph
- The representation is a DAG of gates (hash-consed).
- Identical gates MUST be deduplicated (same op and inputs) to maximize structural sharing.
- All gate creation is pure: no mutation of existing nodes.

---

## 4. Semantics

Let an *assignment* be a function `σ: VAR -> {0,1}` that assigns values to all `VAR` nodes.
Evaluation `⟦id⟧_σ` is defined recursively:
- `⟦CONST0⟧_σ = 0`
- `⟦CONST1⟧_σ = 1`
- `⟦VAR(name)⟧_σ = σ(name)`
- `⟦XOR(a,b)⟧_σ = ⟦a⟧_σ ⊕ ⟦b⟧_σ` (addition modulo 2)
- `⟦AND(a,b)⟧_σ = ⟦a⟧_σ ∧ ⟦b⟧_σ`

**GF(2) view** (algebraic interpretation):
- XOR is addition in the field GF(2)
- AND is multiplication in GF(2)
- Each node denotes a polynomial over GF(2) evaluated on Boolean inputs

---

## 5. Constraint Model

A theory is a set of constraints over wires:
- ASSERT1(w): w == 1
- ASSERT0(w): w == 0
- ASSERT_EQ(a, b): a == b (encoded as XOR(a, b) == 0)

Equations are polynomials in GF(2) set to 0.

---

## 6. Kernel API

Minimal async API (hosted as JS module, async-first). All ids are node ids:

```typescript
interface UBHKernel {
  // Constructors
  const0(): Promise<NodeId>;
  const1(): Promise<NodeId>;
  var(name: string): Promise<NodeId>;
  xor(a: NodeId, b: NodeId): Promise<NodeId>;
  and(a: NodeId, b: NodeId): Promise<NodeId>;
  
  // Constraints
  assert1(w: NodeId, originId?: OriginId): void;
  assert0(w: NodeId, originId?: OriginId): void;
  assertEq(a: NodeId, b: NodeId, originId?: OriginId): void;
  
  // Solving
  solve(): Promise<SolveResult>;
  prove(phi: NodeId): Promise<ProveResult>;
}

interface SolveResult {
  status: "SAT" | "UNSAT" | "UNKNOWN";
  model?: Map<NodeId, 0 | 1>;
  certificate?: Certificate;
  unsatCore?: OriginId[];
}

interface ProveResult {
  status: "PROVED" | "DISPROVED" | "UNKNOWN";
  model?: Map<NodeId, 0 | 1>;
  certificate?: Certificate;
  unsatCore?: OriginId[];
}
```

`prove(phi)` is defined as `solve(T && NOT(phi))`:
- PROVED = UNSAT (no counterexample exists)
- DISPROVED = SAT (counterexample found)

### 6.1 Determinism Contract
- For a given kernel instance, repeated creation of the "same" VAR or gate MUST return the same id (hash-consing).
- For commutative gates (XOR, AND), the kernel MUST canonicalize input order so `xor(a,b) == xor(b,a)`.
- Node ids are stable only within the process lifetime.

---

## 7. Simplification Rules (Kernel-Level)

Lightweight rewrites applied at creation time (before hash-consing):
- XOR(x, 0) = x
- XOR(x, x) = 0
- AND(x, 0) = 0
- AND(x, 1) = x
- AND(x, x) = x
- NOT(x) = XOR(1, x)

These MUST NOT change satisfiability.

---

## 8. Solving Strategy

**See**: DS-002 (Solver Interface and XOR Handling)

- **CNF**: AND gates are encoded with Tseitin clauses.
- **XOR**: XOR constraints are treated as linear equations over GF(2) with incremental Gaussian elimination.
- **Mixed propagation**: SAT decisions propagate into XOR; XOR propagation can force SAT assignments.

---

## 9. Proof and Diagnostics

**See**: DS-011 (Backends and Certificates), DS-014 (Certificate Formats)

- `UNSAT` must return a checkable certificate (DRAT/LRAT) or be confirmed by a trusted checker.
- `SAT` is accepted if the returned model satisfies all constraints under UBH evaluation.
- Unsat cores should reference `originId`s for explainability.

**Acceptance Rule**:
```
SAT   → model must evaluate to 1 under all constraints
UNSAT → certificate must be checkable OR confirmed by trusted route
        (otherwise return UNKNOWN)
```

---

## 10. How the Vision is Implemented

### 10.1 From CNL to Results

```
User writes:  "For all Cell c: if geneA(c) then proteinP(c)."
              "c0 has geneA."
              "Does c0 have proteinP?"

                    ▼ DS-005 (CNL Parser)
                    
CNL AST:      ForAll(c:Cell, Implies(geneA(c), proteinP(c)))
              Pred(geneA, [c0])
              Query: Pred(proteinP, [c0])

                    ▼ DS-006 (Type Resolution)
                    
Typed AST:    [typed and validated]

                    ▼ DS-007 (Compile to UBH)
                    
UBH:          wire_geneA_c0 = VAR("geneA(c0)")
              wire_proteinP_c0 = VAR("proteinP(c0)")
              impl = OR(NOT(wire_geneA_c0), wire_proteinP_c0)
              ASSERT1(impl)
              ASSERT1(wire_geneA_c0)

                    ▼ DS-002 (Solver)
                    
Result:       PROVED (proteinP(c0) must be true)

                    ▼ DS-009 (Explain)
                    
Explanation:  "c0 has proteinP because:
               - c0 has geneA (fact)
               - for all Cell c: geneA(c) implies proteinP(c) (rule)"
```

### 10.2 Specification Dependency Graph

```
DS00-vision (this doc)
    │
    ├── DS-001 IR and Hash-Consing
    │       └── implements: wire/gate storage
    │
    ├── DS-002 Solver Interface
    │       └── implements: SAT+XOR solving
    │
    ├── DS-003 Front-end Compilation
    │       └── defines: how higher logics compile to UBH
    │
    ├── DS-004 Schema Engine
    │       └── implements: lazy quantifier instantiation
    │
    ├── DS-005 CNL (human language)
    │   │   └── defines: natural language input format
    │   │
    │   └── DS-008 DSL (machine language)
    │           └── defines: programming language format
    │           └── isomorphic to DS-005
    │
    ├── DS-006 Typed AST Pipeline
    │       └── defines: shared representation after parsing
    │
    ├── DS-007 Compile to UBH
    │       └── implements: typed AST → UBH wires
    │
    ├── DS-009 Sessions
    │       └── implements: learn/query/explain API
    │
    ├── DS-010 Fragments and Goals
    │       └── defines: problem classification
    │
    ├── DS-011 Backends and Certificates
    │       └── defines: what backends exist, what certs required
    │
    ├── DS-012 Orchestrator
    │       └── implements: planning and dispatch
    │
    ├── DS-013 Probabilistic Engine
    │       └── extends: WMC/KC for probabilistic queries
    │
    ├── DS-014 Certificate Formats
    │       └── defines: how to represent and check certificates
    │
    ├── DS-015 GAMP Traceability
    │       └── defines: requirements → specs → tests mapping
    │
    ├── DS-016 Error Handling
    │       └── defines: error taxonomy and reporting
    │
    ├── DS-017 Universal CNL Extensions
    │       └── extends: modal/temporal/domain templates
    │
    ├── DS-018 CNL↔DSL Translator
    │       └── implements: bidirectional translation
    │
    └── DS-019 Keywords and Operators
            └── defines: reserved words for both languages
```

---

## 11. Front-end Integration Contract

Front-ends are responsible for:
- Defining data types as bitvectors or finite domains
- Compiling high-level formulas to UBH gates/constraints
- Implementing quantifiers via finite expansion or lazy instantiation (CEGAR)

**See**: DS-003 (Front-end Compilation), DS-004 (Schema Engine)

---

## 12. CNL/DSL Front-end Requirements

**See**: DS-005 (CNL), DS-008 (DSL)

- Two isomorphic languages: CNL (human-friendly), DSL (machine-friendly)
- A shared lexicon defines symbols, arities, and finite domains
- Both parsers must be deterministic; ambiguous inputs are rejected
- The AST lowers to core logic (forall/exists/and/or/not/implies) before UBH compilation

---

## 13. Non-Goals

The kernel does NOT:
- Parse natural language (that's the CNL front-end)
- Implement rich types beyond Bit (that's the front-end's job)
- Expose solver-specific internal state
- Trust solver results without certificates

---

## 14. Success Criteria

UBHNL is successful when:

1. **A domain expert** can write rules in CNL without programming knowledge
2. **A developer** can read/write DSL files and integrate with automation
3. **Every PROVED/UNSAT claim** is backed by a checkable certificate
4. **Every DISPROVED/SAT claim** includes a verifiable counterexample
5. **Explanations** reference the user's vocabulary and source locations
6. **The system** is deterministic and reproducible

---

## References

- `docs/specs/src/system-spec.md` - Full system layering
- `docs/specs/src/implementation-plan.md` - Milestone-based implementation
- `docs/gamp/URS.md` - User Requirements Specification
- `docs/gamp/FS.md` - Functional Specification
- `docs/gamp/NFS.md` - Non-Functional Specification
