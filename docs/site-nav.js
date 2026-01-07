/* UBHNL site navigation injector (static docs, no build step). */

function computePrefixToDocsRoot() {
  const rawPath = String(window.location.pathname || "").replace(/\\/g, "/");
  const idx = rawPath.lastIndexOf("/docs/");
  const rel = idx >= 0 ? rawPath.slice(idx + "/docs/".length) : rawPath.replace(/^\/+/, "");
  const parts = rel.split("/").filter(Boolean);
  const depth = Math.max(0, parts.length - 1);
  return "../".repeat(depth);
}

function normalizeHrefForCompare(href) {
  try {
    const u = new URL(href, window.location.href);
    return u.pathname.replace(/\\/g, "/") + (u.search || "");
  } catch {
    return href;
  }
}

function buildHeaderMenu(prefix) {
  const menu = document.createElement("nav");
  menu.className = "site-nav";

  const links = [
    ["Index", "index.html"],
    ["Vision", "vision.html"],
    ["Architecture", "architecture.html"],
    ["Languages", "languages.html"],
    ["Session API", "session-api.html"],
    ["Reasoning", "reasoning.html"],
    ["Examples", "examples.html"],
    ["Wiki", "wiki/index.html"],
    ["Theory", "theory/index.html"],
    ["GAMP", "gamp/metrics.html"],
    ["Specs", "mdview.html?file=specs/src/system-spec.md"]
  ];

  const here = normalizeHrefForCompare(window.location.href);

  for (const [label, href] of links) {
    const a = document.createElement("a");
    a.textContent = label;
    a.href = prefix + href;
    if (normalizeHrefForCompare(a.href) === here) a.className = "active";
    menu.appendChild(a);
  }

  return menu;
}

function injectHeaderNav() {
  const header = document.querySelector("header");
  if (!header) return;

  const prefix = computePrefixToDocsRoot();
  if (header.querySelector(".site-header-row")) return;

  const row = document.createElement("div");
  row.className = "site-header-row";

  row.appendChild(buildHeaderMenu(prefix));
  header.appendChild(row);
}

function injectPageDiagram() {
  const main = document.querySelector("main");
  if (!main) return;

  if (main.querySelector(".page-diagram-wrap")) return;

  const prefix = computePrefixToDocsRoot();
  const wrap = document.createElement("div");
  wrap.className = "page-diagram-wrap";

  const img = document.createElement("img");
  img.className = "page-diagram";
  img.alt = "UBHNL pipeline diagram";
  img.src = prefix + "assets/site-diagram.svg";
  wrap.appendChild(img);

  const first = main.firstElementChild;
  if (first) {
    main.insertBefore(wrap, first);
  } else {
    main.appendChild(wrap);
  }
}

try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectHeaderNav();
      injectPageDiagram();
    });
  } else {
    injectHeaderNav();
    injectPageDiagram();
  }
} catch {
  // ignore, site should still render without the menu
}
