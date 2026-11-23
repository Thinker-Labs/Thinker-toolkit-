import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { installTarget } from "../src/core/installer";

describe("Installer", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "thinker-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create .cursorrules when target is cursor", () => {
    const res = installTarget("cursor", { cwd: tempDir });
    expect(res.action).toBe("created");
    expect(fs.existsSync(path.join(tempDir, ".cursorrules"))).toBe(true);
    const content = fs.readFileSync(path.join(tempDir, ".cursorrules"), "utf-8");
    expect(content).toContain("Thinker Toolkit Protocol");
  });

  it("should backup existing file before creating new one when overwrite is false", () => {
    const targetFile = path.join(tempDir, "CLAUDE.md");
    fs.writeFileSync(targetFile, "ORIGINAL CONTENT");

    const res = installTarget("claude", { cwd: tempDir, overwrite: false });
    expect(res.action).toBe("backed_up_and_created");
    expect(fs.existsSync(`${targetFile}.bak`)).toBe(true);
    expect(fs.readFileSync(`${targetFile}.bak`, "utf-8")).toBe("ORIGINAL CONTENT");
  });
});

describe("Repeat-safe setup", () => {
 const dirs:string[]=[];
 function fixture(){const p=fs.mkdtempSync(path.join(os.tmpdir(),"thinker-safe-"));dirs.push(p);return p;}
 afterEach(()=>{for(const p of dirs.splice(0))fs.rmSync(p,{recursive:true,force:true});});
 it.each(["claude","cursor","windsurf","antigravity"] as const)("preserves custom %s rules and is idempotent",target=>{
  const cwd=fixture();const first=installTarget(target,{cwd});fs.appendFileSync(first.filePath,"\nMy custom rule.\n");const before=fs.readFileSync(first.filePath,"utf8");expect(installTarget(target,{cwd}).action).toBe("skipped");expect(fs.readFileSync(first.filePath,"utf8")).toBe(before);
 });
 it("keeps original and subsequent backups",()=>{const cwd=fixture(),f=path.join(cwd,"CLAUDE.md");fs.writeFileSync(f,"ORIGINAL");installTarget("claude",{cwd});fs.appendFileSync(f,"CUSTOM");installTarget("claude",{cwd,overwrite:true});expect(fs.readFileSync(f+".bak","utf8")).toBe("ORIGINAL");expect(fs.readFileSync(f+".bak.1","utf8")).toContain("CUSTOM");});
 it("merges VS Code metadata without replacing user settings",()=>{const cwd=fixture();fs.mkdirSync(path.join(cwd,".vscode"));const f=path.join(cwd,".vscode/settings.json");fs.writeFileSync(f,JSON.stringify({"editor.formatOnSave":false,"typescript.tsdk":"custom","custom.key":1}));installTarget("vscode",{cwd});const c=JSON.parse(fs.readFileSync(f,"utf8"));expect(c["editor.formatOnSave"]).toBe(false);expect(c["typescript.tsdk"]).toBe("custom");expect(c["custom.key"]).toBe(1);expect(c["thinker.enabled"]).toBe(true);expect(installTarget("vscode",{cwd}).action).toBe("skipped");});
 it("refuses JSONC without changing it",()=>{const cwd=fixture();fs.mkdirSync(path.join(cwd,".vscode"));const f=path.join(cwd,".vscode/settings.json");fs.writeFileSync(f,'{ // custom\n}');expect(()=>installTarget("vscode",{cwd})).toThrow("strict JSON");expect(fs.readFileSync(f,"utf8")).toBe('{ // custom\n}');});
 it("refuses malformed managed markers",()=>{const cwd=fixture();fs.writeFileSync(path.join(cwd,"CLAUDE.md"),"<!-- thinker-toolkit:start -->\ncustom");expect(()=>installTarget("claude",{cwd})).toThrow("Ambiguous");});
 it.skipIf(process.platform==="win32")("refuses symlink targets and parents",()=>{const cwd=fixture(),outside=fixture();fs.writeFileSync(path.join(outside,"secret"),"untouched");fs.symlinkSync(path.join(outside,"secret"),path.join(cwd,"CLAUDE.md"));expect(()=>installTarget("claude",{cwd})).toThrow("symlink");fs.symlinkSync(outside,path.join(cwd,".vscode"));expect(()=>installTarget("vscode",{cwd})).toThrow("symlink");expect(fs.readFileSync(path.join(outside,"secret"),"utf8")).toBe("untouched");});
});
