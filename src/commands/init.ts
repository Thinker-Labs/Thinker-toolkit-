import prompts from "prompts";
import pc from "picocolors";
import { detectWorkspace, type SupportedIDE } from "../core/detector";
import { installTarget } from "../core/installer";
import { logger } from "../utils/logger";

export async function initCommand(options: { yes?: boolean } = {}) {
  logger.info(pc.bold("\n  Thinker Toolkit — IDE Integration Setup\n"));

  const workspace = detectWorkspace();
  logger.dim(`  Detected framework: ${workspace.framework}`);
  logger.dim(`  Package manager:    ${workspace.packageManager}`);
  logger.dim(`  Git repository:     ${workspace.hasGit ? "yes" : "no"}\n`);

  let selectedIDEs: SupportedIDE[] = workspace.detectedIDEs;

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
        { title: "Google Antigravity (.gemini/rules)", value: "antigravity" },
      ],
      hint: "- Space to select. Enter to submit",
    });

    selectedIDEs = response.ides || [];
  } else if (selectedIDEs.length === 0) {
    // Default fallback in --yes mode
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
        logger.info(`  ✓ Configured ${pc.cyan(ide)} (backup: ${res.backupPath})`);
      } else {
        logger.success(`  ✓ Configured ${pc.cyan(ide)} -> ${res.filePath}`);
      }
    } catch (err: any) {
      failures++;
      logger.error(`  ✗ Failed to configure ${ide}: ${err.message}`);
    }
  }

  if (failures) {
    logger.error(`\nSetup incomplete: ${failures} target(s) failed. Review the errors above.\n`);
    process.exitCode = 1;
  } else logger.success("\nSetup complete. Review the generated files and backups before using them.\n");
}
