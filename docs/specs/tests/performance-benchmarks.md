# Performance Benchmark Suite

This document defines the benchmark workloads and targets referenced by the
performance gates in `docs/specs/tests/test-plan.md`.

## General Rules

- Run benchmarks on a warm process (discard first run).
- Use wall-clock time for end-to-end measurements.
- Report median of 5 runs (min/max optional).
- Record machine details: CPU model, RAM, OS, Node version.
- No network or external services.

Reference runner (optional):
```
npm run perfbench -- --bench=1,2,3,4
node src/devtests/run.mjs --perf --bench=1,2,3,4
```

## Benchmark 1: CNL Parsing

**Goal**: Parse + typecheck 10k CNL lines in < 1s.

**Input generation**:
- Domain: `Person`, `Symptom`.
- Constants: `p0..p9999` as `Person`, `Fever` as `Symptom`.
- Lines: `pN has Fever.` for N in `0..9999`.

**Procedure**:
1. Generate a single CNL file with 10,000 statements.
2. Measure: file read -> parsed CNL -> typed AST.
3. Exclude output serialization from timing.

**Metric**: wall-clock time (ms).
**Target**: < 1000 ms.

## Benchmark 2: UBH Compilation

**Goal**: Compile 100k predicate instances to UBH IR in < 2s.

**Input generation**:
- Domain: `Person`.
- Predicate: `Trusts Person Person`.
- Instances: 100,000 facts `Trusts pI pJ` (deterministic pairs).

**Procedure**:
1. Build a typed AST with 100k predicate instances.
2. Measure: typed AST -> UBH IR (hash-consed wires).

**Metric**: wall-clock time (ms).
**Target**: < 2000 ms.

## Benchmark 3: Kernel Memory

**Goal**: Sustain 1e6 wire ids without failure.

**Input generation**:
- Create a large linear chain or a wide set of independent atoms to reach 1,000,000 wires.

**Procedure**:
1. Construct 1,000,000 distinct wires via kernel API.
2. Measure: peak RSS (resident set size) and success/failure.

**Metric**: peak RSS (MB) and completion status.
**Target**: successful completion without OOM.

## Benchmark 4: Query Latency

**Goal**: Query latency < 200 ms with 1k facts, 100 rules.

**Input generation**:
- Facts: 1,000 ground facts over a small domain.
- Rules: 100 Horn-like rules (no recursion).
- Query: single goal that requires a small proof.

**Procedure**:
1. Load facts and rules into a session.
2. Warm up with one dry-run query.
3. Measure: query request -> solver response.

**Metric**: wall-clock time (ms), report median of 5 runs.
**Target**: < 200 ms.

## Reporting Format

Use this template for results:

```
Benchmark: <name>
Machine: <cpu>, <ram>, <os>, Node <version>
Runs (ms): [r1, r2, r3, r4, r5]
Median (ms): <median>
Target: <target>
Status: PASS|FAIL
Notes: <optional>
```

## Results

### Benchmark 1: CNL Parsing

Benchmark: CNL Parsing (10k lines)
Machine: 12th Gen Intel(R) Core(TM) i7-12700H, 15.3 GB, linux 6.17.12-300.fc43.x86_64, Node v24.11.0
Runs (ms): [20.30, 15.83, 14.89, 14.58, 11.22]
Median (ms): 14.89
Target: < 1000 ms
Status: PASS
Notes: Measured `parseCnlToTypedAst` on in-memory CNL (typechecked against prebuilt vocab).

### Benchmark 2: UBH Compilation

Benchmark: UBH Compilation (100k instances)
Machine: 12th Gen Intel(R) Core(TM) i7-12700H, 15.3 GB, linux 6.17.12-300.fc43.x86_64, Node v24.11.0
Runs (ms): [145.36]
Median (ms): 145.36
Target: < 2000 ms
Status: PASS
Notes: Typed AST facts compiled via `compileStatements` with vocabulary-backed type checks.

### Benchmark 3: Kernel Memory

Benchmark: Kernel Memory (1e6 wires)
Machine: 12th Gen Intel(R) Core(TM) i7-12700H, 15.3 GB, linux 6.17.12-300.fc43.x86_64, Node v24.11.0
Runs (ms): [1,000,000 wires, RSS 379.0 MB, delta 147.4 MB]
Median (ms): n/a
Target: successful completion without OOM
Status: PASS
Notes: Kernel created 1,000,000 atoms with hash-consing disabled.

### Benchmark 4: Query Latency

Benchmark: Query Latency (1k facts, 100 rules)
Machine: 12th Gen Intel(R) Core(TM) i7-12700H, 15.3 GB, linux 6.17.12-300.fc43.x86_64, Node v24.11.0
Runs (ms): [1.05, 0.48, 0.49, 0.49, 0.41]
Median (ms): 0.49
Target: < 200 ms
Status: PASS
Notes: Non-recursive Horn-style rules with a single variable.
