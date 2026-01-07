/* UBHNL site navigation injector (static docs, no build step). */

function computeDocsRoot() {
  const script = document.currentScript || document.querySelector('script[src*="site-nav.js"]');
  if (script && script.src) {
    const url = new URL(script.src, window.location.href);
    return url.href.replace(/site-nav\.js(?:\?.*)?$/, "");
  }

  const rawPath = String(window.location.pathname || "").replace(/\\/g, "/");
  const idx = rawPath.lastIndexOf("/docs/");
  const rel = idx >= 0 ? rawPath.slice(idx + "/docs/".length) : rawPath.replace(/^\/+/, "");
  const parts = rel.split("/").filter(Boolean);
  const depth = Math.max(0, parts.length - 1);
  return "../".repeat(depth);
}

function joinRoot(root, href) {
  if (!root) return href;
  if (root.endsWith("/")) return root + href;
  return root + "/" + href;
}

function normalizeHrefForCompare(href) {
  try {
    const u = new URL(href, window.location.href);
    return u.pathname.replace(/\\/g, "/") + (u.search || "");
  } catch {
    return href;
  }
}

function buildHeaderMenu(root) {
  const menu = document.createElement("nav");
  menu.className = "site-nav";

  const links = [
    ["Home", "index.html"],
    ["Architecture", "architecture.html"],
    ["Reasoning", "reasoning.html"],
    ["Theory", "theory/index.html"],
    ["Syntax", "languages.html"],
    ["APIs", "session-api.html"],
    ["Wiki", "wiki/index.html"],
    ["Specs", "gamp/metrics.html"],
    ["Vision", "vision/index.html"]
  ];

  const here = normalizeHrefForCompare(window.location.href);

  for (let i = 0; i < links.length; i++) {
    const [label, href] = links[i];
    const a = document.createElement("a");
    a.textContent = label;
    a.href = joinRoot(root, href);
    if (normalizeHrefForCompare(a.href) === here) a.className = "active";
    menu.appendChild(a);
    
    if (i < links.length - 1) {
      const sep = document.createTextNode(" · ");
      menu.appendChild(sep);
    }
  }

  return menu;
}

function injectHeaderNav() {
  const header = document.querySelector("header");
  if (!header) return;

  const root = computeDocsRoot();
  if (header.querySelector(".site-header-row")) return;

  const row = document.createElement("div");
  row.className = "site-header-row";

  row.appendChild(buildHeaderMenu(root));
  header.appendChild(row);
}

function injectPageDiagram() {
  const main = document.querySelector("main");
  if (!main) return;

  const allowDiagram = document.body && document.body.classList.contains("with-diagram");
  if (!allowDiagram) return;

  if (main.querySelector(".page-diagram-wrap")) return;

  const root = computeDocsRoot();
  const wrap = document.createElement("div");
  wrap.className = "page-diagram-wrap";

  const img = document.createElement("img");
  img.className = "page-diagram";
  img.alt = "UBHNL pipeline diagram";
  img.src = joinRoot(root, "assets/site-diagram.svg");
  wrap.appendChild(img);

  const first = main.firstElementChild;
  if (first) {
    main.insertBefore(wrap, first);
  } else {
    main.appendChild(wrap);
  }
}

function injectFooter() {
  const main = document.querySelector("main");
  if (!main) return;
  if (document.querySelector(".site-footer")) return;

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <hr />
    <p>Research conducted by <a href="https://www.axiologic.net">Axiologic Research</a> as part of the European research project <a href="https://www.achilles-project.eu/">Achilles</a>.</p>
    <p><strong>Disclaimer:</strong> This documentation was generated with AI assistance (LLMs) and may contain errors or hallucinations. The system is open source—verify claims by examining the code, evaluation suites, and automated tests.</p>
  `;
  main.appendChild(footer);
}

try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectHeaderNav();
      injectPageDiagram();
      injectFooter();
    });
  } else {
    injectHeaderNav();
    injectPageDiagram();
    injectFooter();
  }
} catch {
  // ignore, site should still render without the menu
}
