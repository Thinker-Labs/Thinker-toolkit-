import { describe,it,expect,vi,afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { verifyCommand } from "../src/commands/verify";
vi.mock("node:child_process",()=>({spawnSync:vi.fn()}));
afterEach(()=>{vi.resetAllMocks();process.exitCode=0;});
function result(status:number|null,error?:Error){return {status,error,stdout:"",stderr:"",signal:null,pid:1,output:[]};}
describe("Verification results",()=>{
 it("fails by default if either required command fails",()=>{vi.mocked(spawnSync).mockReturnValueOnce(result(0) as never).mockReturnValueOnce(result(1) as never).mockReturnValueOnce(result(0) as never);expect(verifyCommand().filter(r=>r.status==="failed")).toHaveLength(1);expect(process.exitCode).toBe(1);});
 it("reports failures without failing only with explicit lenient mode",()=>{vi.mocked(spawnSync).mockReturnValue(result(1) as never);expect(verifyCommand({lenient:true})[0].status).toBe("failed");expect(process.exitCode).toBe(0);});
 it("handles timeouts as failures",()=>{vi.mocked(spawnSync).mockReturnValue(result(null,new Error("timeout")) as never);expect(verifyCommand()[0].detail).toContain("timeout");expect(process.exitCode).toBe(1);});
 it("does not fail passing required checks for unavailable Git",()=>{vi.mocked(spawnSync).mockReturnValueOnce(result(0) as never).mockReturnValueOnce(result(0) as never).mockReturnValueOnce(result(1) as never);expect(verifyCommand()[2].status).toBe("informational");expect(process.exitCode).toBe(0);});
 it("rejects contradictory modes before executing",()=>{expect(()=>verifyCommand({strict:true,lenient:true})).toThrow();expect(spawnSync).not.toHaveBeenCalled();});
});
