# Specification Backlog

Remaining work for UBHNL specification cleanup and implementation readiness.

---

## Chapter 1: CLI & User Interaction Specification

**Priority:** High (Blocking User Interaction)
**Status:** Missing

### Problem
While the architecture (`DS00`) defines the internal layers (CNL -> Orchestrator -> Kernel), there is no specification for the actual Command Line Interface (CLI) or entry point for the end-user. We do not know:
- The binary name and subcommands structure.
- How to pass arguments (files, verbosity, output formats).
- Exit codes and standard stream usage (stdout vs stderr).
- Environment variables configuration.
- Interactive mode (REPL) behavior if supported.

### Proposed Solutions

1.  **Strict Subcommand Structure (Rust-style)**
    - Use `clap` or similar library.
    - `ubhnl compile <file>`
    - `ubhnl solve <file>`
    - `ubhnl check <file>` (verify certificates)
    - `ubhnl repl`
    
2.  **Unified Driver (GCC-style)**
    - `ubhnl <file> -o <output>`
    - Flags control the stage: `--parse-only`, `--emit-dsl`, `--solve`.
    
3.  **Language Server Protocol (LSP) First**
    - The binary primarily acts as an LSP server.
    - CLI is just a thin wrapper around LSP commands.

---

## Chapter 2: Hashcons Garbage Collection Strategy

**Priority:** Medium (Blocking Long-Running Processes)
**Status:** Undefined in `DS01`

### Problem
`DS01-ir-hashcons.md` specifies that "Node ids are stable only within the process lifetime" but does not define a memory management policy. In a hash-consing system, nodes are never duplicated. Without a GC strategy, the memory usage will grow monotonically with every operation (creating gates, simplifying expressions). This creates a memory leak for long-running sessions (e.g., a server or REPL).

### Proposed Solutions

1.  **Reference Counting with Generation IDs**
    - Each node tracks refcount.
    - When refcount drops to 0, return ID to a free pool?
    - *Risk:* Fragile with stable IDs requirement.

2.  **Mark-and-Sweep (Epoch-based)**
    - Stop-the-world or incremental mark phase starting from "live" roots (current session variables).
    - Sweep phase removes unreachable nodes from the hash map.
    - *Constraint:* Requires the kernel to know all external roots.

3.  **Arena Allocation (No GC for MVP)**
    - Allocate nodes in large blocks (Arenas).
    - Free the entire Arena only when the Session ends.
    - Accept memory growth during a single session.
    - *Verdict:* Best for initial implementation, but needs explicit documentation as a limitation.

---

## Chapter 3: Integration Testing Harness

**Priority:** Medium
**Status:** Partially covered by `fastEval`

### Problem
We have `evals/fastEval` for input/output pairs, but we lack a specification for:
- Testing the CLI itself (argument parsing, exit codes).
- Testing failure modes (does the system crash or exit gracefully on OOM?).
- Performance regression testing (tracking timings over commits).
- Fuzzing strategy (generating random CNL/DSL to find crashes).

### Proposed Solutions

1.  **Snapshot Testing**
    - Capture stdout/stderr for CLI commands.
    - Compare against stored "golden" files.

2.  **Scripted Integration Tests**
    - Python/Shell scripts that run the binary and inspect exit codes and file artifacts.

3.  **Internal Benchmarking Suite**
    - A dedicated `bench` command in the CLI that runs standard problems and outputs JSON metrics for CI tracking.
