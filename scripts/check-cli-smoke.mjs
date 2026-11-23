import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
const root=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'thinker-cli-check-'));const cli=path.join(root,'bin/thinker.js');
try{
 spawnSync('git',['init'],{cwd:dir});fs.writeFileSync(path.join(dir,'thinker.config.json'),JSON.stringify({version:1,checks:[{name:'should not run',command:[process.execPath,'-e','require("fs").writeFileSync("executed","oops")']}]}));
 for(const args of [['check','--plan'],['doctor'],['check']]){const r=spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8'});const expected=args.length===1&&args[0]==='check'?1:0;if(r.status!==expected)throw Error(r.stderr);if(fs.existsSync(path.join(dir,'executed')))throw Error('Untrusted command executed');}
 const unknown=spawnSync(process.execPath,[cli,'receipt'],{cwd:dir});if(unknown.status!==1)throw Error('Missing receipt should fail');
 console.log('CLI trust/plan/doctor/missing receipt checks pass.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
