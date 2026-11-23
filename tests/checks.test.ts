import {describe,it,expect,afterEach} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {loadConfig,runConfigured,saveReceipt,checkLatest,redact,safePath,executeCheck} from '../src/core/checks';
const roots:string[]=[];afterEach(()=>{for(const r of roots)fs.rmSync(r,{recursive:true,force:true});roots.length=0;delete process.env.TEST_SECRET;});
function repo(){const r=fs.mkdtempSync(path.join(os.tmpdir(),'thinker-check-'));roots.push(r);spawnSync('git',['init'],{cwd:r});fs.writeFileSync(path.join(r,'a.txt'),'one');return r;}
const command=(code:string)=>[process.execPath,'-e',code];
function config(r:string,checks:unknown[]){fs.writeFileSync(path.join(r,'thinker.config.json'),JSON.stringify({version:1,checks}));return loadConfig(r);}
describe('configured checks and receipts',()=>{
 it('runs argv without a shell and saves a current receipt',async()=>{const r=repo(),cfg=config(r,[{name:'test',command:command('console.log("hello")')}]);const receipt=await runConfigured(r,cfg);expect(receipt.passed).toBe(true);const files=saveReceipt(r,receipt);expect(fs.readFileSync(files.markdown,'utf8')).toContain('PASS');expect(checkLatest(r).passed).toBe(true);fs.writeFileSync(path.join(r,'a.txt'),'two');expect(checkLatest(r).stale).toBe(true);});
 it('does not treat optional failure as a required failure',async()=>{const r=repo(),cfg=config(r,[{name:'optional',command:command('process.exit(2)'),required:false}]);expect((await runConfigured(r,cfg)).passed).toBe(true);});
 it('fails a required failure and missing executable',async()=>{const r=repo(),cfg=config(r,[{name:'bad',command:['thinker-command-that-does-not-exist']}]);expect((await runConfigured(r,cfg)).passed).toBe(false);});
 it('marks a tree modified during checks stale',async()=>{const r=repo(),cfg=config(r,[{name:'mutate',command:command('require("fs").writeFileSync("a.txt","changed")')}]);expect((await runConfigured(r,cfg)).stale).toBe(true);});
 it('handles timeouts',async()=>{const r=repo();expect((await executeCheck(r,{name:'slow',command:command('setTimeout(()=>{},10000)'),timeoutMs:30})).status).toBe('timeout');});
 it('redacts known environment secrets and common tokens',()=>{process.env.TEST_SECRET='private-value-123';expect(redact('private-value-123 token=abc')).toBe('[REDACTED] token=[REDACTED]');});
 it('rejects unsafe cwd, duplicate names and empty check configs',()=>{const r=repo();expect(()=>config(r,[{name:'bad',command:command(''),cwd:'../'}])).toThrow();expect(()=>config(r,[{name:'x',command:['node']},{name:'x',command:['node']}])).toThrow();expect(()=>config(r,[])).toThrow();});
 it('rejects symlink paths',()=>{if(process.platform==='win32')return;const r=repo();fs.symlinkSync('/tmp',path.join(r,'link'));expect(()=>safePath(r,'link/file')).toThrow();});
 it('bounds check output',async()=>{const r=repo();const x=await executeCheck(r,{name:'large',command:command('process.stdout.write("x".repeat(300000))')});expect(x.output.length).toBeLessThanOrEqual(131072);expect(x.truncated).toBe(true);});
});
