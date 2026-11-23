// src/commands/check.ts
import fs2 from "fs";
import path2 from "path";
import { spawnSync as spawnSync2 } from "child_process";

// src/core/checks.ts
import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { spawn, spawnSync } from "child_process";
function safePath(root, relative) {
  const base = fs.realpathSync(root), full = path.resolve(base, relative);
  if (full !== base && !full.startsWith(base + path.sep)) throw Error("Path escapes project root");
  const pieces = path.relative(path.parse(base).root, full).split(path.sep);
  let at = path.parse(base).root;
  for (const piece of pieces) {
    at = path.join(at, piece);
    try {
      if (fs.lstatSync(at).isSymbolicLink()) throw Error("Symlink paths are not supported");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  return full;
}
function loadConfig(root, file = "thinker.config.json") {
  const input = fs.readFileSync(safePath(root, file), "utf8");
  if (Buffer.byteLength(input) > 65536) throw Error("Config exceeds 64 KiB");
  const x = JSON.parse(input);
  if (x.version !== 1 || !Array.isArray(x.checks) || x.checks.length < 1 || x.checks.length > 30) throw Error("Config needs version 1 and 1-30 checks");
  const names = /* @__PURE__ */ new Set();
  for (const c of x.checks) {
    if (!c || typeof c.name !== "string" || !c.name.trim() || c.name.length > 100 || names.has(c.name)) throw Error("Each check needs a unique name (1-100 characters)");
    names.add(c.name);
    if (!Array.isArray(c.command) || !c.command.length || c.command.length > 100 || c.command.some((v) => typeof v !== "string" || v.includes("\0") || v.length > 4096) || !c.command[0]) throw Error("Commands must be nonempty string arrays");
    if (c.cwd !== void 0 && typeof c.cwd !== "string") throw Error("cwd must be a relative path");
    if (c.cwd && path.isAbsolute(c.cwd)) throw Error("cwd must be relative");
    const cwd = safePath(root, c.cwd || ".");
    if (!fs.statSync(cwd).isDirectory()) throw Error("Check cwd is not a directory");
    if (c.timeoutMs !== void 0 && (!Number.isSafeInteger(c.timeoutMs) || c.timeoutMs < 10 || c.timeoutMs > 6e5)) throw Error("timeoutMs must be 10-600000");
    if (c.required !== void 0 && typeof c.required !== "boolean") throw Error("required must be boolean");
  }
  return x;
}
function git(root, args) {
  const x = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 1e4, maxBuffer: 8 * 1024 * 1024 });
  return x.status === 0 && !x.error ? x.stdout.trim() : null;
}
function fingerprint(root) {
  const result = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8", timeout: 1e4, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0 || result.error) throw Error("Receipts require a Git repository and working git command");
  const names = [...new Set(result.stdout.split("\0").filter(Boolean))].filter((p) => !p.startsWith(".thinker/") && !p.startsWith("node_modules/")).sort();
  if (names.length > 2e4) throw Error("Receipt file limit exceeded");
  const hash = createHash("sha256");
  for (const name of names) {
    const full = safePath(root, name);
    hash.update(name + "\0");
    if (!fs.existsSync(full)) {
      hash.update("missing\0");
      continue;
    }
    const s = fs.statSync(full);
    if (!s.isFile() || s.size > 10 * 1024 * 1024) throw Error("Unsupported file or file over 10 MiB in receipt scope");
    hash.update(String(s.mode) + "\0");
    hash.update(fs.readFileSync(full));
    hash.update("\0");
  }
  return hash.digest("hex");
}
function redact(text) {
  let out = text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  for (const [name, value] of Object.entries(process.env)) if (/token|secret|password|api_?key|authorization|credential/i.test(name) && value && value.length >= 4) out = out.split(value).join("[REDACTED]");
  return out.replace(/(?:npm_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]+)/g, "[REDACTED]").replace(/((?:password|token|secret|api[_-]?key|authorization)\s*[:=]\s*)\S+/gi, "$1[REDACTED]");
}
async function executeCheck(root, c) {
  const start = Date.now();
  let output = "", truncated = false, timed = false;
  return new Promise((resolve) => {
    const command = [...c.command];
    if (process.platform === "win32" && ["npm", "npx"].includes(command[0])) {
      const npm = process.env.npm_execpath;
      if (!npm) {
        resolve({ name: c.name, command: c.command, cwd: c.cwd || ".", required: c.required !== false, status: "failed", exitCode: null, durationMs: 0, output: "On Windows invoke node with the npm/npx CLI file, or run from npm so npm_execpath is set.", truncated: false });
        return;
      }
      command.splice(0, 1, process.execPath, command[0] === "npm" ? npm : path.join(path.dirname(npm), "npx-cli.js"));
    }
    const child = spawn(command[0], command.slice(1), { cwd: safePath(root, c.cwd || "."), shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    function collect(b) {
      const text = b.toString("utf8");
      const remaining = 131072 - output.length;
      if (text.length > remaining) truncated = true;
      if (remaining > 0) output += text.slice(0, remaining);
    }
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const stop = () => {
      timed = true;
      try {
        if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 5e3 });
        else if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    };
    const timer = setTimeout(stop, c.timeoutMs ?? 12e4);
    let error = "";
    child.on("error", (e) => {
      error = e.message;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ name: redact(c.name), command: c.command.map(redact), cwd: c.cwd || ".", required: c.required !== false, status: timed ? "timeout" : code === 0 && !error ? "passed" : "failed", exitCode: code, durationMs: Date.now() - start, output: redact(error + "\n" + output).trim(), truncated });
    });
  });
}
async function runConfigured(root, config) {
  const startedAt = (/* @__PURE__ */ new Date()).toISOString(), before = fingerprint(root), head = git(root, ["rev-parse", "HEAD"]), base = git(root, ["rev-parse", "HEAD^"]);
  const dirty = Boolean(git(root, ["status", "--porcelain"]));
  const checks = [];
  for (const c of config.checks) checks.push(await executeCheck(root, c));
  const after = fingerprint(root), stale = before !== after || head !== git(root, ["rev-parse", "HEAD"]);
  return { schemaVersion: 1, id: randomUUID(), startedAt, finishedAt: (/* @__PURE__ */ new Date()).toISOString(), git: { head, base, dirty }, fingerprintBefore: before, fingerprintAfter: after, stale, passed: !stale && checks.every((c) => !c.required || c.status === "passed"), checks };
}
function receiptMarkdown(r) {
  return `# Thinker review receipt

Result: ${r.passed ? "PASS" : "FAIL"}${r.stale ? " (tree changed during checks)" : ""}

Head: ${r.git.head ?? "unborn"}
Parent: ${r.git.base ?? "none"}
Dirty at start: ${r.git.dirty}
Finished: ${r.finishedAt}

${r.checks.map((c) => `- ${c.name.replace(/[\r\n]/g, " ")}: ${c.status} (${c.required ? "required" : "optional"}, exit ${c.exitCode ?? "none"}, ${c.durationMs} ms)`).join("\n")}

Local evidence, not tamper-proof attestation. Applies only to the captured non-ignored Git working tree. Logs and commands may contain private information despite best-effort redaction. Nothing is uploaded.
`;
}
function saveReceipt(root, r) {
  const dir = safePath(root, ".thinker/receipts");
  fs.mkdirSync(dir, { recursive: true, mode: 448 });
  const json = safePath(root, `.thinker/receipts/${r.id}.json`), markdown = safePath(root, `.thinker/receipts/${r.id}.md`);
  fs.writeFileSync(json, JSON.stringify(r, null, 2) + "\n", { flag: "wx", mode: 384 });
  fs.writeFileSync(markdown, receiptMarkdown(r), { flag: "wx", mode: 384 });
  fs.writeFileSync(safePath(root, ".thinker/receipts/latest.json"), JSON.stringify({ id: r.id }) + "\n", { mode: 384 });
  return { json, markdown };
}
function checkLatest(root) {
  const x = JSON.parse(fs.readFileSync(safePath(root, ".thinker/receipts/latest.json"), "utf8"));
  if (typeof x.id !== "string" || !/^[a-f0-9-]{36}$/.test(x.id)) throw Error("Invalid receipt pointer");
  const r = JSON.parse(fs.readFileSync(safePath(root, `.thinker/receipts/${x.id}.json`), "utf8"));
  if (r.schemaVersion !== 1 || typeof r.fingerprintAfter !== "string" || !Array.isArray(r.checks)) throw Error("Unsupported receipt");
  const stale = r.stale || r.fingerprintAfter !== fingerprint(root) || r.git.head !== git(root, ["rev-parse", "HEAD"]);
  return { passed: r.passed === true && !stale, stale, id: x.id };
}

// src/commands/check.ts
async function checkCommand(options = {}) {
  const root = process.cwd(), config = loadConfig(root, options.config);
  console.log("Project check plan (commands run repository code with your permissions):");
  for (const c of config.checks) console.log(redact(`${c.name}: ${JSON.stringify(c.command)} [${c.cwd || "."}] ${c.required === false ? "optional" : "required"}`));
  if (options.plan) return;
  if (!options.trust) {
    console.error("Not run. Review the config, then pass --trust to authorize these local commands.");
    process.exitCode = 1;
    return;
  }
  const r = await runConfigured(root, config), files = saveReceipt(root, r);
  for (const c of r.checks) console.log(`${c.name}: ${c.status}${c.output ? "\n" + c.output : ""}`);
  console.log(`Receipt: ${files.json}
Summary: ${files.markdown}`);
  console.log(r.passed ? "Required checks passed for this tree." : "Required checks failed or tree changed during execution.");
  if (!r.passed) process.exitCode = 1;
}
function receiptCommand() {
  const x = checkLatest(process.cwd());
  console.log(`Receipt ${x.id}: ${x.stale ? "STALE" : x.passed ? "PASS" : "FAIL"}`);
  if (!x.passed) process.exitCode = 1;
}
function doctorCommand(options = {}) {
  const root = process.cwd();
  let failed = false;
  console.log(`Node: ${process.version}`);
  const git2 = spawnSync2("git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8", timeout: 1e4 });
  console.log(`Git: ${git2.status === 0 ? "available" : "unavailable or not a repository"}`);
  if (git2.status !== 0) failed = true;
  try {
    const cfg = loadConfig(root, options.config);
    console.log(`Config: valid (${cfg.checks.length} checks). No project commands executed.`);
    for (const c of cfg.checks) {
      const cmd = c.command[0], candidates = cmd.includes("/") || cmd.includes("\\") ? [path2.resolve(root, c.cwd || ".", cmd)] : (process.env.PATH || "").split(path2.delimiter).flatMap((d) => process.platform === "win32" ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";").map((e) => path2.join(d, cmd + e)) : [path2.join(d, cmd)]);
      const found = candidates.some((p) => {
        try {
          return fs2.statSync(p).isFile();
        } catch {
          return false;
        }
      });
      console.log(`${c.name}: executable ${found ? "found" : "not found on PATH"} (${redact(cmd)})`);
      if (!found) failed = true;
    }
  } catch (e) {
    console.error(`Config: ${e.message}`);
    failed = true;
  }
  for (const name of ["AGENTS.md", ".github/copilot-instructions.md", "CLAUDE.md", ".cursorrules", ".windsurfrules", ".vscode/settings.json", ".gemini/rules/thinker.md"]) {
    try {
      const p = safePath(root, name);
      if (fs2.existsSync(p)) console.log(`Target present: ${name} (file presence does not prove assistant compliance)`);
    } catch (e) {
      console.error(e.message);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
}

// src/cli.ts
import { Command } from "commander";

// src/commands/init.ts
import prompts from "prompts";
import pc2 from "picocolors";

// src/core/detector.ts
import fs3 from "fs";
import path3 from "path";
function detectWorkspace(targetDir = process.cwd()) {
  const cwd = path3.resolve(targetDir);
  const hasGit = fs3.existsSync(path3.join(cwd, ".git")) || fs3.existsSync(path3.join(cwd, "../.git"));
  let packageManager = "npm";
  if (fs3.existsSync(path3.join(cwd, "pnpm-lock.yaml"))) {
    packageManager = "pnpm";
  } else if (fs3.existsSync(path3.join(cwd, "yarn.lock"))) {
    packageManager = "yarn";
  } else if (fs3.existsSync(path3.join(cwd, "bun.lockb")) || fs3.existsSync(path3.join(cwd, "bun.lock"))) {
    packageManager = "bun";
  }
  let framework = "unknown";
  const pkgPath = path3.join(cwd, "package.json");
  if (fs3.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs3.readFileSync(pkgPath, "utf-8"));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies
      };
      if (allDeps["next"]) {
        framework = "next";
      } else if (allDeps["vite"]) {
        framework = "vite";
      } else {
        framework = "node";
      }
    } catch {
      framework = "node";
    }
  } else if (fs3.existsSync(path3.join(cwd, "requirements.txt")) || fs3.existsSync(path3.join(cwd, "pyproject.toml"))) {
    framework = "python";
  }
  const detectedIDEs = [];
  if (fs3.existsSync(path3.join(cwd, "AGENTS.md"))) detectedIDEs.push("agents");
  if (fs3.existsSync(path3.join(cwd, ".github/copilot-instructions.md"))) detectedIDEs.push("copilot");
  if (fs3.existsSync(path3.join(cwd, ".cursor")) || fs3.existsSync(path3.join(cwd, ".cursorrules"))) {
    detectedIDEs.push("cursor");
  }
  if (fs3.existsSync(path3.join(cwd, ".claude")) || fs3.existsSync(path3.join(cwd, "CLAUDE.md"))) {
    detectedIDEs.push("claude");
  }
  if (fs3.existsSync(path3.join(cwd, ".vscode"))) {
    detectedIDEs.push("vscode");
  }
  if (fs3.existsSync(path3.join(cwd, ".windsurfrules")) || fs3.existsSync(path3.join(cwd, ".windsurf"))) {
    detectedIDEs.push("windsurf");
  }
  if (fs3.existsSync(path3.join(cwd, ".gemini")) || fs3.existsSync(path3.join(process.env.HOME || "", ".gemini/antigravity"))) {
    detectedIDEs.push("antigravity");
  }
  return {
    cwd,
    framework,
    packageManager,
    detectedIDEs,
    hasGit
  };
}

// src/core/installer.ts
import fs4 from "fs";
import path4 from "path";
import { randomUUID as randomUUID2 } from "crypto";

// src/core/registry.ts
var CORE_SKILLS = [
  {
    id: "systematic-debugging",
    name: "Systematic Debugging",
    description: "Rigorous 4-step root cause analysis before modifying any code",
    category: "debugging",
    rulesContent: `### Rule: Systematic Debugging Protocol
1. Never apply random fixes or speculate. Formulate a specific hypothesis first.
2. Isolate the exact reproduction steps and inspect actual stack traces/logs.
3. Verify the root cause before touching implementation files.
4. Add regression test assertions to guarantee the bug never returns.`
  },
  {
    id: "test-driven-development",
    name: "Test-Driven Development",
    description: "Enforce failing tests before writing production code",
    category: "testing",
    rulesContent: `### Rule: Test-Driven Development (TDD)
1. Write a focused, failing unit or integration test before implementing functionality.
2. Run the test and verify it fails with the expected assertion error.
3. Write the minimal production code needed to satisfy the test.
4. Run the test suite to confirm passing status, then refactor cleanly.`
  },
  {
    id: "verification-before-completion",
    name: "Verification Before Completion",
    description: "Mandatory pre-flight checks before marking tasks resolved",
    category: "testing",
    rulesContent: `### Rule: Verification Before Completion
1. Never claim a task or bugfix is complete without concrete execution evidence.
2. Run full type checking (e.g. \`tsc --noEmit\`).
3. Run linting and automated unit/integration test suites.
4. Verify application build succeeds with zero errors.`
  },
  {
    id: "parallel-worktrees",
    name: "Parallel Worktree Orchestration",
    description: "Subagent isolation across independent Git worktrees",
    category: "workflow",
    rulesContent: `### Rule: Subagent Worktree Isolation
1. Independent features or refactors must execute in isolated Git worktrees.
2. Prevent state collision and file locking between parallel agents.
3. Merge back via explicit verification barriers and code review checks.`
  }
];
function listSkills() {
  return CORE_SKILLS;
}
function getSkill(id) {
  return CORE_SKILLS.find((s) => s.id === id);
}

// src/templates/cursor.ts
function renderCursorRules(skills) {
  const rules = skills.map((s) => s.rulesContent).join("\n\n");
  return `# Thinker Toolkit Protocol (Cursor)
# Generated automatically by thinker-toolkit

You are an expert AI software engineer operating under Thinker Toolkit protocols.
Always adhere strictly to the engineering rules below without shortcuts or guesswork.

${rules}
`;
}

// src/templates/claude.ts
function renderClaudeRules(skills) {
  const rules = skills.map((s) => s.rulesContent).join("\n\n");
  return `# CLAUDE.md - Thinker Toolkit Directives
# Generated automatically by thinker-toolkit

You are an expert engineer adhering to Thinker Toolkit engineering principles.

## Core Protocols
${rules}
`;
}

// src/templates/windsurf.ts
function renderWindsurfRules(skills) {
  const rules = skills.map((s) => s.rulesContent).join("\n\n");
  return `# .windsurfrules - Thinker Toolkit
# Generated automatically by thinker-toolkit

${rules}
`;
}

// src/templates/vscode.ts
function renderVSCodeSettings(skills) {
  return JSON.stringify(
    {
      "thinker.enabled": true,
      "thinker.protocols": skills.map((s) => s.id),
      "editor.formatOnSave": true,
      "typescript.tsdk": "node_modules/typescript/lib"
    },
    null,
    2
  );
}

// src/templates/antigravity.ts
function renderAntigravityRules(skills) {
  const rules = skills.map((s) => s.rulesContent).join("\n\n");
  return `# Thinker Toolkit Global Rules for Google Antigravity
# Generated automatically by thinker-toolkit

${rules}
`;
}

// src/core/installer.ts
var START = "<!-- thinker-toolkit:start -->";
var END = "<!-- thinker-toolkit:end -->";
function assertSafePath(cwd, fullPath) {
  let part = cwd;
  const entries = [cwd, ...path4.relative(cwd, fullPath).split(path4.sep).map((segment) => part = path4.join(part, segment))];
  for (const entry of entries) {
    let stat;
    try {
      stat = fs4.lstatSync(entry);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink path: ${entry}`);
  }
  if (!fullPath.startsWith(cwd + path4.sep)) throw new Error("Target must be inside the workspace");
}
function mergeRules(existing, content) {
  const block = `${START}
${content.trimEnd()}
${END}`;
  const starts = existing.split(START).length - 1;
  const ends = existing.split(END).length - 1;
  if (!starts && !ends) return existing ? `${existing}${existing.endsWith("\n") ? "" : "\n"}
${block}
` : `${block}
`;
  const begin = existing.indexOf(START), end = existing.indexOf(END);
  if (starts !== 1 || ends !== 1 || end < begin) throw new Error("Ambiguous Thinker markers. Review the file before setup; it was not changed.");
  return existing.slice(0, begin) + block + existing.slice(end + END.length);
}
function mergeSettings(existing, content) {
  let parsed;
  try {
    parsed = JSON.parse(existing);
  } catch {
    throw new Error("Existing VS Code settings are not strict JSON (possibly JSONC). No change made. Merge settings manually or use --overwrite explicitly.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("VS Code settings must be a JSON object. No change made.");
  const current = parsed;
  const generated = JSON.parse(content);
  for (const [key, value] of Object.entries(generated)) if (key.startsWith("thinker.")) current[key] = value;
  return JSON.stringify(current, null, 2) + "\n";
}
function installTarget(target, options = {}) {
  const cwd = path4.resolve(options.cwd || process.cwd());
  const skills = options.skills || CORE_SKILLS;
  const templates = {
    agents: ["AGENTS.md", renderClaudeRules],
    copilot: [path4.join(".github", "copilot-instructions.md"), renderClaudeRules],
    cursor: [".cursorrules", renderCursorRules],
    claude: ["CLAUDE.md", renderClaudeRules],
    windsurf: [".windsurfrules", renderWindsurfRules],
    vscode: [path4.join(".vscode", "settings.json"), renderVSCodeSettings],
    antigravity: [path4.join(".gemini", "rules", "thinker.md"), renderAntigravityRules]
  };
  if (!(target in templates)) throw new Error(`Unsupported IDE target: ${target}`);
  const [relativePath, render] = templates[target];
  const fullPath = path4.join(cwd, relativePath);
  assertSafePath(cwd, fullPath);
  const exists = fs4.existsSync(fullPath);
  if (exists && !fs4.statSync(fullPath).isFile()) throw new Error(`Target is not a regular file: ${fullPath}`);
  const existing = exists ? fs4.readFileSync(fullPath, "utf8") : "";
  const generated = render(skills);
  const content = options.overwrite ? generated : target === "vscode" ? exists ? mergeSettings(existing, generated) : generated + "\n" : mergeRules(existing, generated);
  if (exists && content === existing) return { target, filePath: fullPath, action: "skipped" };
  fs4.mkdirSync(path4.dirname(fullPath), { recursive: true });
  let backupPath;
  if (exists) {
    for (let i = 0; ; i++) {
      const candidate = `${fullPath}.bak${i ? `.${i}` : ""}`;
      try {
        fs4.copyFileSync(fullPath, candidate, fs4.constants.COPYFILE_EXCL);
        backupPath = candidate;
        break;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
  }
  const temp = path4.join(path4.dirname(fullPath), `.thinker-${randomUUID2()}.tmp`);
  try {
    fs4.writeFileSync(temp, content, { flag: "wx", mode: exists ? fs4.statSync(fullPath).mode & 511 : 384 });
    fs4.renameSync(temp, fullPath);
  } finally {
    if (fs4.existsSync(temp)) fs4.unlinkSync(temp);
  }
  return { target, filePath: fullPath, action: exists ? options.overwrite ? "overwritten" : "backed_up_and_created" : "created", backupPath };
}

// src/utils/logger.ts
import pc from "picocolors";
var logger = {
  info: (msg) => console.log(pc.white(msg)),
  success: (msg) => console.log(pc.green(msg)),
  warn: (msg) => console.log(pc.yellow(msg)),
  error: (msg) => console.error(pc.red(msg)),
  dim: (msg) => console.log(pc.dim(msg)),
  bold: (msg) => pc.bold(msg)
};

// src/commands/init.ts
async function initCommand(options = {}) {
  logger.info(pc2.bold("\n  Thinker Toolkit \u2014 IDE Integration Setup\n"));
  const workspace = detectWorkspace();
  logger.dim(`  Detected framework: ${workspace.framework}`);
  logger.dim(`  Package manager:    ${workspace.packageManager}`);
  logger.dim(`  Git repository:     ${workspace.hasGit ? "yes" : "no"}
`);
  let selectedIDEs = workspace.detectedIDEs;
  if (!options.yes && selectedIDEs.length === 0) {
    const response = await prompts({
      type: "multiselect",
      name: "ides",
      message: "Select IDE targets to configure with Thinker skills:",
      choices: [
        { title: "Shared instructions (AGENTS.md)", value: "agents" },
        { title: "GitHub Copilot (.github/copilot-instructions.md)", value: "copilot" },
        { title: "Cursor (.cursorrules)", value: "cursor", selected: true },
        { title: "Claude Code (CLAUDE.md)", value: "claude", selected: true },
        { title: "VS Code (.vscode/settings.json)", value: "vscode" },
        { title: "Windsurf (.windsurfrules)", value: "windsurf" },
        { title: "Google Antigravity (.gemini/rules)", value: "antigravity" }
      ],
      hint: "- Space to select. Enter to submit"
    });
    selectedIDEs = response.ides || [];
  } else if (selectedIDEs.length === 0) {
    selectedIDEs = ["cursor", "claude"];
  }
  if (selectedIDEs.length === 0) {
    logger.warn("  No IDE targets selected. Exiting.");
    return;
  }
  let failures = 0;
  for (const ide of selectedIDEs) {
    try {
      const res = installTarget(ide, { cwd: workspace.cwd });
      if (res.action === "backed_up_and_created") {
        logger.info(`  \u2713 Configured ${pc2.cyan(ide)} (backup: ${res.backupPath})`);
      } else {
        logger.success(`  \u2713 Configured ${pc2.cyan(ide)} -> ${res.filePath}`);
      }
    } catch (err) {
      failures++;
      logger.error(`  \u2717 Failed to configure ${ide}: ${err.message}`);
    }
  }
  if (failures) {
    logger.error(`
Setup incomplete: ${failures} target(s) failed. Review the errors above.
`);
    process.exitCode = 1;
  } else logger.success("\nSetup complete. Review the generated files and backups before using them.\n");
}

// src/commands/integrate.ts
import pc3 from "picocolors";
async function integrateCommand(target, options = {}) {
  const validTargets = ["cursor", "claude", "vscode", "windsurf", "antigravity", "agents", "copilot"];
  const lower = target.toLowerCase();
  if (!validTargets.includes(lower)) {
    logger.error(`
  Invalid target '${target}'. Available: ${validTargets.join(", ")}
`);
    process.exit(1);
  }
  try {
    const res = installTarget(lower, { overwrite: options.overwrite });
    logger.success(`
  \u2713 Thinker protocol integrated for ${pc3.cyan(lower)}`);
    logger.dim(`    File: ${res.filePath}`);
    logger.dim(`    Status: ${res.action}`);
    if (res.backupPath) logger.dim(`    Backup: ${res.backupPath}`);
  } catch (err) {
    logger.error(`
  \u2717 Integration failed: ${err.message}
`);
    process.exit(1);
  }
}

// src/commands/list.ts
import pc4 from "picocolors";
function listCommand() {
  logger.info(pc4.bold("\n  Thinker Toolkit \u2014 Curated Skills & Invariant Protocols\n"));
  const skills = listSkills();
  for (const s of skills) {
    logger.info(`  ${pc4.cyan(s.id.padEnd(30))} [${s.category}]`);
    logger.dim(`    ${s.description}`);
  }
  logger.info("\n");
}

// src/commands/verify.ts
import { spawnSync as spawnSync3 } from "child_process";
function verifyCommand(options = {}) {
  if (options.strict && options.lenient) throw new Error("Choose --strict or --lenient, not both.");
  const timeout = options.timeout ?? 12e4;
  if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new Error("Timeout must be a positive integer in milliseconds.");
  logger.info("\nThinker verification: project commands run with your current permissions.\n");
  const results = [];
  for (const [name, command] of [["TypeScript", "npx --no-install tsc --noEmit"], ["Tests", "npm test -- --run"]]) {
    logger.info(`Running ${command}`);
    const result = spawnSync3(command, { shell: true, stdio: "inherit", timeout });
    const passed = result.status === 0 && !result.error;
    const detail2 = result.error?.message || (result.signal ? `Terminated: ${result.signal}` : void 0);
    results.push({ name, status: passed ? "passed" : "failed", exitCode: result.status, detail: detail2 });
    (passed ? logger.success : logger.error)(`${name}: ${passed ? "passed" : "failed"}${detail2 ? ` (${detail2})` : ""}`);
  }
  const git2 = spawnSync3("git", ["status", "--porcelain"], { encoding: "utf8", timeout });
  const detail = git2.status !== 0 || git2.error ? "Git status unavailable; not a required check." : git2.stdout.trim() ? "Working tree has uncommitted changes." : "Working tree is clean.";
  results.push({ name: "Git status", status: "informational", exitCode: git2.status, detail });
  logger.info(detail);
  const failed = results.some((r) => r.status === "failed");
  if (failed) {
    logger.error(`
Verification failed.${options.lenient ? " Lenient mode requested: exit code remains zero." : " Required checks did not pass."}`);
    if (!options.lenient) process.exitCode = 1;
  } else logger.success("\nConfigured TypeScript and npm test commands passed. Run lint/build and other project checks separately.");
  return results;
}

// src/cli.ts
function createProgram() {
  const program = new Command();
  program.name("thinker").description("Protocol-driven engineering skills runtime for AI-assisted development").version("0.3.0-dev.0");
  program.command("init").description("Initialize and configure Thinker skills in your workspace").option("-y, --yes", "Skip interactive prompts and use sensible defaults").action(async (options) => {
    await initCommand(options);
  });
  program.command("integrate").description("Integrate Thinker protocols directly into an IDE target").requiredOption("-t, --target <ide>", "Target IDE: cursor, claude, vscode, windsurf, antigravity, agents, copilot").option("-o, --overwrite", "Explicitly replace the whole target file (keeps a versioned backup)").action(async (options) => {
    await integrateCommand(options.target, options);
  });
  program.command("list").description("List all available invariant protocols and skills").action(() => {
    listCommand();
  });
  program.command("verify").description("Run invariant checks, type-checking, and regression barriers").option("--strict", "Fail when types or tests fail (the default)").option("--lenient", "Report failures but allow exit code zero").action((options) => {
    verifyCommand(options);
  });
  program.command("check").description("Run reviewed project-configured checks and save local review receipts").option("--config <path>", "Project config file", "thinker.config.json").option("--plan", "Print the command plan without executing").option("--trust", "Authorize executing the reviewed project commands").action(checkCommand);
  program.command("receipt").description("Check whether the latest local receipt passed and is still current").action(receiptCommand);
  program.command("doctor").description("Inspect config and command availability without running project checks").option("--config <path>", "Project config file", "thinker.config.json").action(doctorCommand);
  return program;
}
function run() {
  const program = createProgram();
  return program.parseAsync(process.argv).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export {
  safePath,
  loadConfig,
  fingerprint,
  redact,
  executeCheck,
  runConfigured,
  receiptMarkdown,
  saveReceipt,
  checkLatest,
  detectWorkspace,
  CORE_SKILLS,
  listSkills,
  getSkill,
  installTarget,
  createProgram,
  run
};
//# sourceMappingURL=chunk-3FKNU4BU.mjs.map