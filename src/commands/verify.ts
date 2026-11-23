import { spawnSync } from "node:child_process";
import { logger } from "../utils/logger";

export interface VerifyOptions { strict?: boolean; lenient?: boolean; timeout?: number }
export interface CheckResult { name: string; status: "passed" | "failed" | "informational"; exitCode: number | null; detail?: string }
export function verifyCommand(options: VerifyOptions = {}): CheckResult[] {
  if (options.strict && options.lenient) throw new Error("Choose --strict or --lenient, not both.");
  const timeout = options.timeout ?? 120_000;
  if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new Error("Timeout must be a positive integer in milliseconds.");
  logger.info("\nThinker verification: project commands run with your current permissions.\n");
  const results: CheckResult[] = [];
  for (const [name, command] of [["TypeScript", "npx --no-install tsc --noEmit"], ["Tests", "npm test -- --run"]]) {
    logger.info(`Running ${command}`);
    const result = spawnSync(command, { shell: true, stdio: "inherit", timeout });
    const passed = result.status === 0 && !result.error;
    const detail = result.error?.message || (result.signal ? `Terminated: ${result.signal}` : undefined);
    results.push({ name, status: passed ? "passed" : "failed", exitCode: result.status, detail });
    (passed ? logger.success : logger.error)(`${name}: ${passed ? "passed" : "failed"}${detail ? ` (${detail})` : ""}`);
  }
  const git = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8", timeout });
  const detail = git.status !== 0 || git.error ? "Git status unavailable; not a required check." : git.stdout.trim() ? "Working tree has uncommitted changes." : "Working tree is clean.";
  results.push({ name: "Git status", status: "informational", exitCode: git.status, detail });
  logger.info(detail);
  const failed = results.some(r => r.status === "failed");
  if (failed) {
    logger.error(`\nVerification failed.${options.lenient ? " Lenient mode requested: exit code remains zero." : " Required checks did not pass."}`);
    if (!options.lenient) process.exitCode = 1;
  } else logger.success("\nConfigured TypeScript and npm test commands passed. Run lint/build and other project checks separately.");
  return results;
}
