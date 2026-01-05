#!/usr/bin/env node

async function main() {
  const banner = [
    "UBH (Universal Boolean Hypergraph)",
    "Minimal kernel scaffold.",
    "See docs/specs for design and roadmap."
  ].join("\n");

  // Async entrypoint placeholder for future CLI and API wiring.
  await Promise.resolve();
  console.log(banner);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exitCode = 1;
});
