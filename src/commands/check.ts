import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkLatest,loadConfig,redact,runConfigured,safePath,saveReceipt} from '../core/checks';

export async function checkCommand(options:{config?:string;trust?:boolean;plan?:boolean}={}){
 const root=process.cwd(),config=loadConfig(root,options.config);
 console.log('Project check plan (commands run repository code with your permissions):');
 for(const c of config.checks)console.log(redact(`${c.name}: ${JSON.stringify(c.command)} [${c.cwd||'.'}] ${c.required===false?'optional':'required'}`));
 if(options.plan)return;
 if(!options.trust){console.error('Not run. Review the config, then pass --trust to authorize these local commands.');process.exitCode=1;return;}
 const r=await runConfigured(root,config),files=saveReceipt(root,r);
 for(const c of r.checks)console.log(`${c.name}: ${c.status}${c.output?'\n'+c.output:''}`);
 console.log(`Receipt: ${files.json}\nSummary: ${files.markdown}`);
 console.log(r.passed?'Required checks passed for this tree.':'Required checks failed or tree changed during execution.');
 if(!r.passed)process.exitCode=1;
}
export function receiptCommand(){const x=checkLatest(process.cwd());console.log(`Receipt ${x.id}: ${x.stale?'STALE':x.passed?'PASS':'FAIL'}`);if(!x.passed)process.exitCode=1;}
export function doctorCommand(options:{config?:string}={}){
 const root=process.cwd();let failed=false;
 console.log(`Node: ${process.version}`);
 const git=spawnSync('git',['rev-parse','--show-toplevel'],{cwd:root,encoding:'utf8',timeout:10000});
 console.log(`Git: ${git.status===0?'available':'unavailable or not a repository'}`);if(git.status!==0)failed=true;
 try{const cfg=loadConfig(root,options.config);console.log(`Config: valid (${cfg.checks.length} checks). No project commands executed.`);
 for(const c of cfg.checks){const cmd=c.command[0],candidates=cmd.includes('/')||cmd.includes('\\')?[path.resolve(root,c.cwd||'.',cmd)]:(process.env.PATH||'').split(path.delimiter).flatMap(d=>(process.platform==='win32'?(process.env.PATHEXT||'.EXE;.CMD;.BAT').split(';').map(e=>path.join(d,cmd+e)):[path.join(d,cmd)]));const found=candidates.some(p=>{try{return fs.statSync(p).isFile()}catch{return false}});console.log(`${c.name}: executable ${found?'found':'not found on PATH'} (${redact(cmd)})`);if(!found)failed=true;}
 }catch(e){console.error(`Config: ${(e as Error).message}`);failed=true;}
 for(const name of ['AGENTS.md','.github/copilot-instructions.md','CLAUDE.md','.cursorrules','.windsurfrules','.vscode/settings.json','.gemini/rules/thinker.md']){try{const p=safePath(root,name);if(fs.existsSync(p))console.log(`Target present: ${name} (file presence does not prove assistant compliance)`);}catch(e){console.error((e as Error).message);failed=true;}}
 if(failed)process.exitCode=1;
}
