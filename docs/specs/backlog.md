# Specification Backlog

Remaining work for UBHNL specification cleanup and implementation readiness.

---

## Chapter 1: Interactive Session CLI Specification

**Priority:** High (Blocking User Interaction)
**Status:** Missing

### Problem
While `DS09` defines the logical concept of a Session and its API (`load`, `learn`, `query`, `explain`), there is no specification for the concrete user interface. Users expect a "chat-like" experience (REPL) where they can interactively build theories and ask questions, not just a batch compiler.

We need to define:
- **REPL Behavior**: Prompt style, multi-line input handling (crucial for blocks), history, auto-completion triggers.
- **Output Formatting**: How to display proofs, witnesses (models), and error diagnostics in a terminal friendly way.
- **Commands**: Mapping "slash commands" (e.g., `/load`, `/reset`, `/debug`) to Session API calls versus treating input as CNL/DSL.
- **Stream Protocol**: If this CLI is intended to drive a UI later, should we define a JSON-RPC over stdout/stdin protocol?

### Proposed Solutions

1.  **Dedicated REPL (The "Chat" Interface)**
    - Default mode when running `ubhnl` without arguments.
    - specialized logic for multi-line inputs (detecting open blocks/parentheses).
    - "Slash commands" for meta-operations: `/load <file>`, `/clear`, `/help`.
    - Distinct visual styles for System (responses), Logic (CNL/DSL), and Errors.

2.  **LSP + Editor Integration**
    - Skip a complex CLI and focus on a Language Server Protocol implementation.
    - The "Chat" happens inside an IDE (like VS Code chat view) or a specialized web UI.
    - *Cons:* Heavy dependency on external tools for basic usage.

3.  **Hybrid "Notebook" Mode**
    - A CLI that can run in "interactive mode" (REPL) or "server mode" (JSON-RPC).
    - Allows a simple terminal chat for quick checks, but powers richer UIs via the server mode.

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
