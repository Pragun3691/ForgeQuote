import {readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

let count=0;
async function check(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const path=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
    if(entry.isDirectory()) await check(path);
    else if(entry.name.endsWith('.js')) {execFileSync(process.execPath,['--check',fileURLToPath(path)],{stdio:'pipe',windowsHide:true});count++;}
  }
}
await check(new URL('../src/',import.meta.url));
await check(new URL('./',import.meta.url));
console.log(`PASS: Node syntax checks for ${count} API source/maintenance modules (no transpilation required).`);
