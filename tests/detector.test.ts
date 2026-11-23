import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectWorkspace } from "../src/core/detector";
describe("Workspace detector", () => {
 it("detects a self-contained Next project and package manager", () => {
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),"thinker-detect-"));
  try { fs.writeFileSync(path.join(cwd,"package.json"),JSON.stringify({dependencies:{next:"*"}}));fs.writeFileSync(path.join(cwd,"pnpm-lock.yaml"),"");fs.mkdirSync(path.join(cwd,".git"));fs.mkdirSync(path.join(cwd,".cursor"));const c=detectWorkspace(cwd);expect(c.framework).toBe("next");expect(c.hasGit).toBe(true);expect(c.packageManager).toBe("pnpm");expect(c.detectedIDEs).toContain("cursor"); }
  finally {fs.rmSync(cwd,{recursive:true,force:true});}
 });
});
