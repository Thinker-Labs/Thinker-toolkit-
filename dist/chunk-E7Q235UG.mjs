// src/cli.ts
import { Command } from "commander";

// src/commands/init.ts
import prompts from "prompts";
import pc2 from "picocolors";

// src/core/detector.ts
import fs from "fs";
import path from "path";
function detectWorkspace(targetDir = process.cwd()) {
  const cwd = path.resolve(targetDir);
  const hasGit = fs.existsSync(path.join(cwd, ".git")) || fs.existsSync(path.join(cwd, "../.git"));
  let packageManager = "npm";
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) {
    packageManager = "pnpm";
  } else if (fs.existsSync(path.join(cwd, "yarn.lock"))) {
    packageManager = "yarn";
  } else if (fs.existsSync(path.join(cwd, "bun.lockb")) || fs.existsSync(path.join(cwd, "bun.lock"))) {
    packageManager = "bun";
  }
  let framework = "unknown";
  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
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
  } else if (fs.existsSync(path.join(cwd, "requirements.txt")) || fs.existsSync(path.join(cwd, "pyproject.toml"))) {
    framework = "python";
  }
  const detectedIDEs = [];
  if (fs.existsSync(path.join(cwd, ".cursor")) || fs.existsSync(path.join(cwd, ".cursorrules"))) {
    detectedIDEs.push("cursor");
  }
  if (fs.existsSync(path.join(cwd, ".claude")) || fs.existsSync(path.join(cwd, "CLAUDE.md"))) {
    detectedIDEs.push("claude");
  }
  if (fs.existsSync(path.join(cwd, ".vscode"))) {
    detectedIDEs.push("vscode");
  }
  if (fs.existsSync(path.join(cwd, ".windsurfrules")) || fs.existsSync(path.join(cwd, ".windsurf"))) {
    detectedIDEs.push("windsurf");
  }
  if (fs.existsSync(path.join(cwd, ".gemini")) || fs.existsSync(path.join(process.env.HOME || "", ".gemini/antigravity"))) {
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
import fs2 from "fs";
import path2 from "path";
import { randomUUID } from "crypto";

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
  const entries = [cwd, ...path2.relative(cwd, fullPath).split(path2.sep).map((segment) => part = path2.join(part, segment))];
  for (const entry of entries) {
    let stat;
    try {
      stat = fs2.lstatSync(entry);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink path: ${entry}`);
  }
  if (!fullPath.startsWith(cwd + path2.sep)) throw new Error("Target must be inside the workspace");
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
  const cwd = path2.resolve(options.cwd || process.cwd());
  const skills = options.skills || CORE_SKILLS;
  const templates = {
    cursor: [".cursorrules", renderCursorRules],
    claude: ["CLAUDE.md", renderClaudeRules],
    windsurf: [".windsurfrules", renderWindsurfRules],
    vscode: [path2.join(".vscode", "settings.json"), renderVSCodeSettings],
    antigravity: [path2.join(".gemini", "rules", "thinker.md"), renderAntigravityRules]
  };
  if (!(target in templates)) throw new Error(`Unsupported IDE target: ${target}`);
  const [relativePath, render] = templates[target];
  const fullPath = path2.join(cwd, relativePath);
  assertSafePath(cwd, fullPath);
  const exists = fs2.existsSync(fullPath);
  if (exists && !fs2.statSync(fullPath).isFile()) throw new Error(`Target is not a regular file: ${fullPath}`);
  const existing = exists ? fs2.readFileSync(fullPath, "utf8") : "";
  const generated = render(skills);
  const content = options.overwrite ? generated : target === "vscode" ? exists ? mergeSettings(existing, generated) : generated + "\n" : mergeRules(existing, generated);
  if (exists && content === existing) return { target, filePath: fullPath, action: "skipped" };
  fs2.mkdirSync(path2.dirname(fullPath), { recursive: true });
  let backupPath;
  if (exists) {
    for (let i = 0; ; i++) {
      const candidate = `${fullPath}.bak${i ? `.${i}` : ""}`;
      try {
        fs2.copyFileSync(fullPath, candidate, fs2.constants.COPYFILE_EXCL);
        backupPath = candidate;
        break;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
  }
  const temp = path2.join(path2.dirname(fullPath), `.thinker-${randomUUID()}.tmp`);
  try {
    fs2.writeFileSync(temp, content, { flag: "wx", mode: exists ? fs2.statSync(fullPath).mode & 511 : 384 });
    fs2.renameSync(temp, fullPath);
  } finally {
    if (fs2.existsSync(temp)) fs2.unlinkSync(temp);
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
  const validTargets = ["cursor", "claude", "vscode", "windsurf", "antigravity"];
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
import { spawnSync } from "child_process";
function verifyCommand(options = {}) {
  if (options.strict && options.lenient) throw new Error("Choose --strict or --lenient, not both.");
  const timeout = options.timeout ?? 12e4;
  if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new Error("Timeout must be a positive integer in milliseconds.");
  logger.info("\nThinker verification: project commands run with your current permissions.\n");
  const results = [];
  for (const [name, command] of [["TypeScript", "npx --no-install tsc --noEmit"], ["Tests", "npm test -- --run"]]) {
    logger.info(`Running ${command}`);
    const result = spawnSync(command, { shell: true, stdio: "inherit", timeout });
    const passed = result.status === 0 && !result.error;
    const detail2 = result.error?.message || (result.signal ? `Terminated: ${result.signal}` : void 0);
    results.push({ name, status: passed ? "passed" : "failed", exitCode: result.status, detail: detail2 });
    (passed ? logger.success : logger.error)(`${name}: ${passed ? "passed" : "failed"}${detail2 ? ` (${detail2})` : ""}`);
  }
  const git = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8", timeout });
  const detail = git.status !== 0 || git.error ? "Git status unavailable; not a required check." : git.stdout.trim() ? "Working tree has uncommitted changes." : "Working tree is clean.";
  results.push({ name: "Git status", status: "informational", exitCode: git.status, detail });
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
  program.name("thinker").description("Protocol-driven engineering skills runtime for AI-assisted development").version("0.2.0");
  program.command("init").description("Initialize and configure Thinker skills in your workspace").option("-y, --yes", "Skip interactive prompts and use sensible defaults").action(async (options) => {
    await initCommand(options);
  });
  program.command("integrate").description("Integrate Thinker protocols directly into an IDE target").requiredOption("-t, --target <ide>", "Target IDE: cursor, claude, vscode, windsurf, antigravity").option("-o, --overwrite", "Explicitly replace the whole target file (keeps a versioned backup)").action(async (options) => {
    await integrateCommand(options.target, options);
  });
  program.command("list").description("List all available invariant protocols and skills").action(() => {
    listCommand();
  });
  program.command("verify").description("Run invariant checks, type-checking, and regression barriers").option("--strict", "Fail when types or tests fail (the default)").option("--lenient", "Report failures but allow exit code zero").action((options) => {
    verifyCommand(options);
  });
  return program;
}
function run() {
  const program = createProgram();
  program.parse(process.argv);
}

export {
  detectWorkspace,
  CORE_SKILLS,
  listSkills,
  getSkill,
  installTarget,
  createProgram,
  run
};
//# sourceMappingURL=chunk-E7Q235UG.mjs.map