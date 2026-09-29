import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!name.startsWith(".")) walk(p); }
    else if (p.endsWith(".js")) files.push(p);
  }
})(root);

const norm = (p) => p.replace(/\\/g, "/");
const src = new Map(files.map((p) => [norm(p), readFileSync(p, "utf8")]));
const exportNames = new Map();
for (const [p, text] of src) {
  const names = new Set();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of text.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  exportNames.set(p, names);
}

const problems = [];
for (const [p, text] of src) {
  for (const m of text.matchAll(/import\s+(?:([A-Za-z0-9_$]+)\s*,\s*)?(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g)) {
    const defaultName = m[1];
    const named = m[2] || "";
    const spec = m[3];
    if (!spec.startsWith(".")) continue;
    const target = join(dirname(p), spec).replace(/\\/g, "/");
    if (!src.has(target)) { problems.push(`${relative(root, p)}: missing module ${spec}`); continue; }
    const ex = exportNames.get(target);
    for (const part of named.split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name && !ex.has(name)) problems.push(`${relative(root, p)}: "${name}" not exported by ${spec}`);
    }
    if (defaultName && !/export\s+default\b/.test(src.get(target))) {
      problems.push(`${relative(root, p)}: default import "${defaultName}" not exported by ${spec}`);
    }
  }
}

// Syntax check each file as an ES module by copying to a .mjs temp file.
const tmp = join(root, ".syntax");
mkdirSync(tmp, { recursive: true });
const syntaxErrors = [];
for (const p of files) {
  const tmpFile = join(tmp, p.slice(root.length).replace(/[\\/]/g, "_") + ".mjs");
  writeFileSync(tmpFile, src.get(norm(p)));
  try {
    execFileSync(process.execPath, ["--check", tmpFile], { stdio: "pipe" });
  } catch (err) {
    syntaxErrors.push(`${relative(root, p)}:\n${(err.stderr || "").toString().trim()}`);
  }
}

console.log(`Checked ${files.length} files.`);
console.log(syntaxErrors.length ? "SYNTAX ERRORS:\n" + syntaxErrors.join("\n\n") : "Syntax: OK");
console.log(problems.length ? "IMPORT PROBLEMS:\n" + problems.join("\n") : "Imports: OK");

/* Report imported bindings that are never referenced in the file body. */
const unused = [];
for (const [p, text] of src) {
  if (p.includes(".syntax")) continue;
  const body = text.replace(/^import[\s\S]*?from\s*["'][^"']+["'];?$/gm, "");
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'][^"']+["']/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (!name) continue;
      const uses = [...body.matchAll(new RegExp(`(?<![\\w$])(?<![.](?!..))${name.replace(/\$/g, "\\$")}(?![\\w$])`, "g"))].length;
      if (uses === 0) unused.push(`${relative(root, p)}: "${name}" imported but unused`);
    }
  }
}
console.log(unused.length ? "UNUSED IMPORTS:\n" + unused.join("\n") : "Unused imports: none");
