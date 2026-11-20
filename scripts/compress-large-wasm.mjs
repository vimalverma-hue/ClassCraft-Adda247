import fs from 'node:fs/promises';import path from 'node:path';import {gzipSync} from 'node:zlib';
const root=path.resolve('dist/client/assets'),entries=await fs.readdir(root),replacements=[];
for(const name of entries){if(!name.endsWith('.wasm'))continue;const file=path.join(root,name),stat=await fs.stat(file);if(stat.size<=25*1024*1024)continue;await fs.writeFile(file+'.gz',gzipSync(await fs.readFile(file)));replacements.push([name,name+'.gz?classslide-compressed-wasm=1']);}
for(const name of entries){if(!/\.(?:js|mjs)$/.test(name))continue;const file=path.join(root,name);let text=await fs.readFile(file,'utf8');const before=text;for(const[from,to]of replacements)text=text.replaceAll(from,to);if(text!==before)await fs.writeFile(file,text);}
for(const[from]of replacements)await fs.unlink(path.join(root,from));
console.log(`Compressed ${replacements.length} oversized WASM asset(s) with runtime decoding.`);
