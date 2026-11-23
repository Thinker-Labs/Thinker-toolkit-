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
    .version("0.2.0");

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
    .requiredOption("-t, --target <ide>", "Target IDE: cursor, claude, vscode, windsurf, antigravity")
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

  return program;
}

export function run() {
  const program = createProgram();
  program.parse(process.argv);
}
