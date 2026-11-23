import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'thinker-demo-'));const cli=path.join(root,'bin/thinker.js');
function run(args,expected=0){const r=spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8',env:{...process.env,NO_COLOR:'1'}});console.log(`$ thinker ${args.join(' ')}\n${r.stdout}${r.stderr}`);if(r.status!==expected)throw Error(`Expected exit ${expected}, got ${r.status}`);}
try{
 spawnSync('git',['init'],{cwd:dir});
 fs.writeFileSync(path.join(dir,'settings.cjs'),'exports.enabled=(value)=>value || true;\n');
 fs.writeFileSync(path.join(dir,'test.cjs'),'const assert=require("node:assert/strict");assert.equal(require("./settings.cjs").enabled(false),false);console.log("false stays false");\n');
 fs.writeFileSync(path.join(dir,'thinker.config.json'),JSON.stringify({version:1,checks:[{name:'regression',command:[process.execPath,'test.cjs'],required:true}]}));
 run(['doctor']);run(['check','--plan']);run(['check'],1);run(['check','--trust'],1);run(['receipt'],1);
 fs.writeFileSync(path.join(dir,'settings.cjs'),'exports.enabled=(value)=>value ?? true;\n');
 run(['check','--trust']);run(['receipt']);
 fs.appendFileSync(path.join(dir,'settings.cjs'),'// another edit\n');run(['receipt'],1);
 console.log('DEMO PASS: refused without trust; failing regression -> fix -> passing receipt -> stale after edit.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
