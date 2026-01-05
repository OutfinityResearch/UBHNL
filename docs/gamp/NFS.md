# NFS (Non-Functional Specification)

## Performance
- Hash-consing must deduplicate identical gates.
- XOR reasoning must be incremental to avoid full re-solve.

## Reliability
- The kernel must not mutate existing nodes.
- All simplifications must preserve satisfiability.

## Maintainability
- Keep the core small; add features via front-ends.
- Clear separation between IR, solver, and compilers.

## Portability
- Node.js runtime, ES modules (.mjs), async-first API.
