import{it,expect,vi,afterEach}from"vitest";
import{initCommand}from"../src/commands/init";
import{detectWorkspace}from"../src/core/detector";
import{installTarget}from"../src/core/installer";
vi.mock("../src/core/detector",()=>({detectWorkspace:vi.fn()}));
vi.mock("../src/core/installer",()=>({installTarget:vi.fn()}));
afterEach(()=>{vi.resetAllMocks();process.exitCode=0;});
it("reports partial setup failure and continues remaining targets",async()=>{vi.mocked(detectWorkspace).mockReturnValue({cwd:"project",framework:"node",packageManager:"npm",detectedIDEs:["claude","cursor"],hasGit:true});vi.mocked(installTarget).mockImplementationOnce(()=>{throw Error("permission denied")}).mockReturnValueOnce({target:"cursor",filePath:".cursorrules",action:"created"});await initCommand({yes:true});expect(installTarget).toHaveBeenCalledTimes(2);expect(process.exitCode).toBe(1);});
