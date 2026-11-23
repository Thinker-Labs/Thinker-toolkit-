export { createProgram, run } from './cli.mjs';
import 'commander';

type SupportedIDE = "cursor" | "claude" | "vscode" | "windsurf" | "antigravity" | "agents" | "copilot";
type SupportedFramework = "next" | "vite" | "node" | "python" | "unknown";
type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
interface WorkspaceContext {
    cwd: string;
    framework: SupportedFramework;
    packageManager: PackageManager;
    detectedIDEs: SupportedIDE[];
    hasGit: boolean;
}
declare function detectWorkspace(targetDir?: string): WorkspaceContext;

interface SkillDefinition {
    id: string;
    name: string;
    description: string;
    category: "debugging" | "testing" | "architecture" | "workflow";
    rulesContent: string;
}
declare const CORE_SKILLS: SkillDefinition[];
declare function listSkills(): SkillDefinition[];
declare function getSkill(id: string): SkillDefinition | undefined;

interface InstallOptions {
    cwd?: string;
    skills?: SkillDefinition[];
    overwrite?: boolean;
}
interface InstallResult {
    target: SupportedIDE;
    filePath: string;
    action: "created" | "overwritten" | "backed_up_and_created" | "skipped";
    backupPath?: string;
}
declare function installTarget(target: SupportedIDE, options?: InstallOptions): InstallResult;

interface ProjectCheck {
    name: string;
    command: string[];
    cwd?: string;
    timeoutMs?: number;
    required?: boolean;
}
interface ProjectConfig {
    version: 1;
    checks: ProjectCheck[];
}
interface RunResult {
    name: string;
    command: string[];
    cwd: string;
    required: boolean;
    status: 'passed' | 'failed' | 'timeout';
    exitCode: number | null;
    durationMs: number;
    output: string;
    truncated: boolean;
}
interface Receipt {
    schemaVersion: 1;
    id: string;
    startedAt: string;
    finishedAt: string;
    git: {
        head: string | null;
        base: string | null;
        dirty: boolean;
    };
    fingerprintBefore: string;
    fingerprintAfter: string;
    stale: boolean;
    passed: boolean;
    checks: RunResult[];
}
declare function safePath(root: string, relative: string): string;
declare function loadConfig(root: string, file?: string): ProjectConfig;
declare function fingerprint(root: string): string;
declare function redact(text: string): string;
declare function executeCheck(root: string, c: ProjectCheck): Promise<RunResult>;
declare function runConfigured(root: string, config: ProjectConfig): Promise<Receipt>;
declare function receiptMarkdown(r: Receipt): string;
declare function saveReceipt(root: string, r: Receipt): {
    json: string;
    markdown: string;
};
declare function checkLatest(root: string): {
    passed: boolean;
    stale: boolean;
    id: string;
};

export { CORE_SKILLS, type InstallOptions, type InstallResult, type PackageManager, type ProjectCheck, type ProjectConfig, type Receipt, type RunResult, type SkillDefinition, type SupportedFramework, type SupportedIDE, type WorkspaceContext, checkLatest, detectWorkspace, executeCheck, fingerprint, getSkill, installTarget, listSkills, loadConfig, receiptMarkdown, redact, runConfigured, safePath, saveReceipt };
