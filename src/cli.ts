import { checkCommand, receiptCommand, doctorCommand } from "./commands/check";
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { integrateCommand } from "./commands/integrate";
import { listCommand } from "./commands/list";
import { verifyCommand } from "./commands/verify";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("thinker")
    .description("Protocol-driven engineering skills runtime for AI-assisted development")
    .version("0.3.0-dev.0");

  program
    .command("init")
    .description("Initialize and configure Thinker skills in your workspace")
    .option("-y, --yes", "Skip interactive prompts and use sensible defaults")
    .action(async (options) => {
      await initCommand(options);
    });

  program
    .command("integrate")
    .description("Integrate Thinker protocols directly into an IDE target")
    .requiredOption("-t, --target <ide>", "Target IDE: cursor, claude, vscode, windsurf, antigravity, agents, copilot")
    .option("-o, --overwrite", "Explicitly replace the whole target file (keeps a versioned backup)")
    .action(async (options) => {
      await integrateCommand(options.target, options);
    });

  program
    .command("list")
    .description("List all available invariant protocols and skills")
    .action(() => {
      listCommand();
    });

  program
    .command("verify")
    .description("Run invariant checks, type-checking, and regression barriers")
    .option("--strict", "Fail when types or tests fail (the default)")
    .option("--lenient", "Report failures but allow exit code zero")
    .action((options) => {
      verifyCommand(options);
    });

  program.command("check").description("Run reviewed project-configured checks and save local review receipts")
    .option("--config <path>", "Project config file", "thinker.config.json")
    .option("--plan", "Print the command plan without executing")
    .option("--trust", "Authorize executing the reviewed project commands")
    .action(checkCommand);
  program.command("receipt").description("Check whether the latest local receipt passed and is still current").action(receiptCommand);
  program.command("doctor").description("Inspect config and command availability without running project checks")
    .option("--config <path>", "Project config file", "thinker.config.json").action(doctorCommand);
  return program;
}

export function run() {
  const program = createProgram();
  return program.parseAsync(process.argv).catch((error: Error) => {
    console.error(error.message); process.exitCode = 1;
  });
}
