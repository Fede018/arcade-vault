#!/usr/bin/env node
// PostToolUse hook (Write|Edit): formats the touched file with Prettier,
// then eslint --fix for code files. Scoped to this project only.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

const IGNORED_SEGMENTS = ["node_modules", ".next", ".git"];

function readStdin() {
  try {
    return readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function main() {
  const raw = readStdin();
  if (!raw) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const filePath =
    payload?.tool_response?.filePath ?? payload?.tool_input?.file_path;
  if (!filePath) return;

  const absPath = path.resolve(filePath);

  // Scope guard: only act on files inside this project.
  const relative = path.relative(PROJECT_ROOT, absPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return;

  const segments = relative.split(path.sep);
  if (segments.some((seg) => IGNORED_SEGMENTS.includes(seg))) return;

  if (!existsSync(absPath)) return;

  const prettierBin = path.join(
    PROJECT_ROOT,
    "node_modules",
    "prettier",
    "bin",
    "prettier.cjs",
  );
  if (existsSync(prettierBin)) {
    spawnSync(process.execPath, [prettierBin, "--write", "--ignore-unknown", absPath], {
      cwd: PROJECT_ROOT,
      stdio: "ignore",
    });
  }

  const ext = path.extname(absPath);
  if (CODE_EXTENSIONS.has(ext)) {
    const eslintBin = path.join(
      PROJECT_ROOT,
      "node_modules",
      "eslint",
      "bin",
      "eslint.js",
    );
    if (existsSync(eslintBin)) {
      spawnSync(process.execPath, [eslintBin, "--fix", absPath], {
        cwd: PROJECT_ROOT,
        stdio: "ignore",
      });
    }
  }
}

main();
process.exit(0);
