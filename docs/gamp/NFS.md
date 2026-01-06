# NFS (Non-Functional Specification)

## Performance
- NFS-PERF-001: Hash-consing must deduplicate identical gates.
- NFS-PERF-002: XOR reasoning must be incremental to avoid full re-solve.

## Reliability
- NFS-REL-001: The kernel must not mutate existing nodes.
- NFS-REL-002: All simplifications must preserve satisfiability.

## Determinism
- NFS-DET-001: CNL/DSL parsing must be deterministic; ambiguous inputs are rejected.
- NFS-DET-002: For a given kernel instance, identical node constructions must yield identical ids (hash-consing).

## Maintainability
- NFS-MAINT-001: Keep the core small; add features via front-ends.
- NFS-MAINT-002: Clear separation between IR, solver, and compilers.

## Portability
- NFS-PORT-001: Node.js runtime, ES modules (.mjs), async-first API.
