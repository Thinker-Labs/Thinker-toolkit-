import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { type SupportedIDE } from "./detector";
import { CORE_SKILLS, type SkillDefinition } from "./registry";
import { renderCursorRules } from "../templates/cursor";
import { renderClaudeRules } from "../templates/claude";
import { renderWindsurfRules } from "../templates/windsurf";
import { renderVSCodeSettings } from "../templates/vscode";
import { renderAntigravityRules } from "../templates/antigravity";

export interface InstallOptions { cwd?: string; skills?: SkillDefinition[]; overwrite?: boolean }
export interface InstallResult {
  target: SupportedIDE;
  filePath: string;
  action: "created" | "overwritten" | "backed_up_and_created" | "skipped";
  backupPath?: string;
}
const START = "<!-- thinker-toolkit:start -->";
const END = "<!-- thinker-toolkit:end -->";

function assertSafePath(cwd: string, fullPath: string) {
  // Reject symlinks in the root and every target ancestor. Never follow a
  // workspace link to overwrite a file outside the selected checkout.
  let part = cwd;
  const entries = [cwd, ...path.relative(cwd, fullPath).split(path.sep).map(segment => (part = path.join(part, segment)))];
  for (const entry of entries) {
    let stat: fs.Stats;
    try { stat = fs.lstatSync(entry); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink path: ${entry}`);
  }
  if (!fullPath.startsWith(cwd + path.sep)) throw new Error("Target must be inside the workspace");
}

function mergeRules(existing: string, content: string): string {
  const block = `${START}\n${content.trimEnd()}\n${END}`;
  const starts = existing.split(START).length - 1;
  const ends = existing.split(END).length - 1;
  if (!starts && !ends) return existing ? `${existing}${existing.endsWith("\n") ? "" : "\n"}\n${block}\n` : `${block}\n`;
  const begin = existing.indexOf(START), end = existing.indexOf(END);
  if (starts !== 1 || ends !== 1 || end < begin) throw new Error("Ambiguous Thinker markers. Review the file before setup; it was not changed.");
  return existing.slice(0, begin) + block + existing.slice(end + END.length);
}

function mergeSettings(existing: string, content: string): string {
  let parsed: unknown;
  try { parsed = JSON.parse(existing); } catch { throw new Error("Existing VS Code settings are not strict JSON (possibly JSONC). No change made. Merge settings manually or use --overwrite explicitly."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("VS Code settings must be a JSON object. No change made.");
  const current = parsed as Record<string, unknown>;
  const generated = JSON.parse(content) as Record<string, unknown>;
  // Preserve all editor preferences. Only Thinker's own keys are managed.
  for (const [key, value] of Object.entries(generated)) if (key.startsWith("thinker.")) current[key] = value;
  return JSON.stringify(current, null, 2) + "\n";
}

export function installTarget(target: SupportedIDE, options: InstallOptions = {}): InstallResult {
  const cwd = path.resolve(options.cwd || process.cwd());
  const skills = options.skills || CORE_SKILLS;
  const templates = {
    agents: ["AGENTS.md", renderClaudeRules], copilot: [path.join(".github", "copilot-instructions.md"), renderClaudeRules],
    cursor: [".cursorrules", renderCursorRules], claude: ["CLAUDE.md", renderClaudeRules],
    windsurf: [".windsurfrules", renderWindsurfRules], vscode: [path.join(".vscode", "settings.json"), renderVSCodeSettings],
    antigravity: [path.join(".gemini", "rules", "thinker.md"), renderAntigravityRules],
  } as const;
  if (!(target in templates)) throw new Error(`Unsupported IDE target: ${target}`);
  const [relativePath, render] = templates[target];
  const fullPath = path.join(cwd, relativePath);
  assertSafePath(cwd, fullPath);
  const exists = fs.existsSync(fullPath);
  if (exists && !fs.statSync(fullPath).isFile()) throw new Error(`Target is not a regular file: ${fullPath}`);
  const existing = exists ? fs.readFileSync(fullPath, "utf8") : "";
  const generated = render(skills);
  const content = options.overwrite ? generated : target === "vscode" ? (exists ? mergeSettings(existing, generated) : generated + "\n") : mergeRules(existing, generated);
  if (exists && content === existing) return { target, filePath: fullPath, action: "skipped" };
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  let backupPath: string | undefined;
  // Even explicit replacement keeps a versioned backup. Never replace a backup.
  if (exists) {
    for (let i = 0; ; i++) {
      const candidate = `${fullPath}.bak${i ? `.${i}` : ""}`;
      try { fs.copyFileSync(fullPath, candidate, fs.constants.COPYFILE_EXCL); backupPath = candidate; break; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    }
  }
  const temp = path.join(path.dirname(fullPath), `.thinker-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temp, content, { flag: "wx", mode: exists ? fs.statSync(fullPath).mode & 0o777 : 0o600 });
    fs.renameSync(temp, fullPath);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  return { target, filePath: fullPath, action: exists ? (options.overwrite ? "overwritten" : "backed_up_and_created") : "created", backupPath };
}
