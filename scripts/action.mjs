import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
if(process.env.THINKER_TRUST_PROJECT_COMMANDS!=='true'){
 console.error('Review the checkout and config, then explicitly set trust-project-commands: true.');process.exit(1);
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=spawnSync(process.execPath,[path.join(root,'bin/thinker.js'),'check','--trust'],{stdio:'inherit',cwd:path.resolve(process.env.GITHUB_WORKSPACE||process.cwd(),process.env.THINKER_PROJECT_DIRECTORY||'.')});
process.exit(result.status??1);
