import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';

export interface ProjectCheck {name:string; command:string[]; cwd?:string; timeoutMs?:number; required?:boolean}
export interface ProjectConfig {version:1; checks:ProjectCheck[]}
export interface RunResult {name:string; command:string[]; cwd:string; required:boolean; status:'passed'|'failed'|'timeout'; exitCode:number|null; durationMs:number; output:string; truncated:boolean}
export interface Receipt {schemaVersion:1; id:string; startedAt:string; finishedAt:string; git:{head:string|null;base:string|null;dirty:boolean}; fingerprintBefore:string;fingerprintAfter:string; stale:boolean; passed:boolean; checks:RunResult[]}
export function safePath(root:string,relative:string):string {
 const base=fs.realpathSync(root),full=path.resolve(base,relative);
 if(full!==base&&!full.startsWith(base+path.sep))throw Error('Path escapes project root');
 const pieces=path.relative(path.parse(base).root,full).split(path.sep);let at=path.parse(base).root;
 for(const piece of pieces){at=path.join(at,piece);try{if(fs.lstatSync(at).isSymbolicLink())throw Error('Symlink paths are not supported');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 return full;
}
export function loadConfig(root:string,file='thinker.config.json'):ProjectConfig {
 const input=fs.readFileSync(safePath(root,file),'utf8');if(Buffer.byteLength(input)>65536)throw Error('Config exceeds 64 KiB');
 const x=JSON.parse(input);
 if(x.version!==1||!Array.isArray(x.checks)||x.checks.length<1||x.checks.length>30)throw Error('Config needs version 1 and 1-30 checks');
 const names=new Set();
 for(const c of x.checks){
  if(!c||typeof c.name!=='string'||!c.name.trim()||c.name.length>100||names.has(c.name))throw Error('Each check needs a unique name (1-100 characters)');names.add(c.name);
  if(!Array.isArray(c.command)||!c.command.length||c.command.length>100||c.command.some((v:unknown)=>typeof v!=='string'||v.includes('\0')||v.length>4096)||!c.command[0])throw Error('Commands must be nonempty string arrays');
  if(c.cwd!==undefined&&typeof c.cwd!=='string')throw Error('cwd must be a relative path');
  if(c.cwd&&path.isAbsolute(c.cwd))throw Error('cwd must be relative');
  const cwd=safePath(root,c.cwd||'.');if(!fs.statSync(cwd).isDirectory())throw Error('Check cwd is not a directory');
  if(c.timeoutMs!==undefined&&(!Number.isSafeInteger(c.timeoutMs)||c.timeoutMs<10||c.timeoutMs>600000))throw Error('timeoutMs must be 10-600000');
  if(c.required!==undefined&&typeof c.required!=='boolean')throw Error('required must be boolean');
 }
 return x;
}
function git(root:string,args:string[]):string|null {const x=spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024});return x.status===0&&!x.error?x.stdout.trim():null;}
export function fingerprint(root:string):string {
 const result=spawnSync('git',['ls-files','-co','--exclude-standard','-z'],{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024});
 if(result.status!==0||result.error)throw Error('Receipts require a Git repository and working git command');
 const names=[...new Set(result.stdout.split('\0').filter(Boolean))].filter(p=>!p.startsWith('.thinker/')&&!p.startsWith('node_modules/')).sort();
 if(names.length>20000)throw Error('Receipt file limit exceeded');
 const hash=createHash('sha256');
 for(const name of names){const full=safePath(root,name);hash.update(name+'\0');if(!fs.existsSync(full)){hash.update('missing\0');continue;}const s=fs.statSync(full);if(!s.isFile()||s.size>10*1024*1024)throw Error('Unsupported file or file over 10 MiB in receipt scope');hash.update(String(s.mode)+'\0');hash.update(fs.readFileSync(full));hash.update('\0');}
 return hash.digest('hex');
}
export function redact(text:string):string {
 let out=text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'');
 for(const [name,value]of Object.entries(process.env))if(/token|secret|password|api_?key|authorization|credential/i.test(name)&&value&&value.length>=4)out=out.split(value).join('[REDACTED]');
 return out.replace(/(?:npm_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]+)/g,'[REDACTED]').replace(/((?:password|token|secret|api[_-]?key|authorization)\s*[:=]\s*)\S+/gi,'$1[REDACTED]');
}
export async function executeCheck(root:string,c:ProjectCheck):Promise<RunResult>{
 const start=Date.now();let output='',truncated=false,timed=false;
 return new Promise(resolve=>{
  // No shell interpretation on Unix. Windows npm.cmd requires cmd.exe; use Node's
  // npm CLI entrypoint rather than silently enabling a shell for configured input.
  const command=[...c.command];
  if(process.platform==='win32'&&['npm','npx'].includes(command[0])){
   const npm=process.env.npm_execpath;
   if(!npm){resolve({name:c.name,command:c.command,cwd:c.cwd||'.',required:c.required!==false,status:'failed',exitCode:null,durationMs:0,output:'On Windows invoke node with the npm/npx CLI file, or run from npm so npm_execpath is set.',truncated:false});return;}
   command.splice(0,1,process.execPath,command[0]==='npm'?npm:path.join(path.dirname(npm),'npx-cli.js'));
  }
  const child=spawn(command[0],command.slice(1),{cwd:safePath(root,c.cwd||'.'),shell:false,windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
  function collect(b:Buffer){const text=b.toString('utf8');const remaining=131072-output.length;if(text.length>remaining)truncated=true;if(remaining>0)output+=text.slice(0,remaining);}
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  const stop=()=>{timed=true;try{if(process.platform==='win32')spawnSync('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,timeout:5000});else if(child.pid)process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}};
  const timer=setTimeout(stop,c.timeoutMs??120000);let error='';child.on('error',e=>{error=e.message;});
  child.on('close',code=>{clearTimeout(timer);resolve({name:redact(c.name),command:c.command.map(redact),cwd:c.cwd||'.',required:c.required!==false,status:timed?'timeout':code===0&&!error?'passed':'failed',exitCode:code,durationMs:Date.now()-start,output:redact(error+'\n'+output).trim(),truncated});});
 });
}
export async function runConfigured(root:string,config:ProjectConfig):Promise<Receipt>{
 const startedAt=new Date().toISOString(),before=fingerprint(root),head=git(root,['rev-parse','HEAD']),base=git(root,['rev-parse','HEAD^']);
 const dirty=Boolean(git(root,['status','--porcelain']));const checks:RunResult[]=[];
 for(const c of config.checks)checks.push(await executeCheck(root,c));
 const after=fingerprint(root),stale=before!==after||head!==git(root,['rev-parse','HEAD']);
 return {schemaVersion:1,id:randomUUID(),startedAt,finishedAt:new Date().toISOString(),git:{head,base,dirty},fingerprintBefore:before,fingerprintAfter:after,stale,passed:!stale&&checks.every(c=>!c.required||c.status==='passed'),checks};
}
export function receiptMarkdown(r:Receipt):string {
 return `# Thinker review receipt\n\nResult: ${r.passed?'PASS':'FAIL'}${r.stale?' (tree changed during checks)':''}\n\nHead: ${r.git.head??'unborn'}\nParent: ${r.git.base??'none'}\nDirty at start: ${r.git.dirty}\nFinished: ${r.finishedAt}\n\n${r.checks.map(c=>`- ${c.name.replace(/[\r\n]/g,' ')}: ${c.status} (${c.required?'required':'optional'}, exit ${c.exitCode??'none'}, ${c.durationMs} ms)`).join('\n')}\n\nLocal evidence, not tamper-proof attestation. Applies only to the captured non-ignored Git working tree. Logs and commands may contain private information despite best-effort redaction. Nothing is uploaded.\n`;
}
export function saveReceipt(root:string,r:Receipt):{json:string;markdown:string}{
 const dir=safePath(root,'.thinker/receipts');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const json=safePath(root,`.thinker/receipts/${r.id}.json`),markdown=safePath(root,`.thinker/receipts/${r.id}.md`);
 fs.writeFileSync(json,JSON.stringify(r,null,2)+'\n',{flag:'wx',mode:0o600});fs.writeFileSync(markdown,receiptMarkdown(r),{flag:'wx',mode:0o600});
 fs.writeFileSync(safePath(root,'.thinker/receipts/latest.json'),JSON.stringify({id:r.id})+'\n',{mode:0o600});return {json,markdown};
}
export function checkLatest(root:string):{passed:boolean;stale:boolean;id:string}{
 const x=JSON.parse(fs.readFileSync(safePath(root,'.thinker/receipts/latest.json'),'utf8'));if(typeof x.id!=='string'||!/^[a-f0-9-]{36}$/.test(x.id))throw Error('Invalid receipt pointer');
 const r=JSON.parse(fs.readFileSync(safePath(root,`.thinker/receipts/${x.id}.json`),'utf8')) as Receipt;
 if(r.schemaVersion!==1||typeof r.fingerprintAfter!=='string'||!Array.isArray(r.checks))throw Error('Unsupported receipt');
 const stale=r.stale||r.fingerprintAfter!==fingerprint(root)||r.git.head!==git(root,['rev-parse','HEAD']);return {passed:r.passed===true&&!stale,stale,id:x.id};
}
