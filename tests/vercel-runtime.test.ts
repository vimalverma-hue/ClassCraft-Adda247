import {expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

it('loads compiled API routes in real Node ESM without a bundler',()=>{
  const output='test-output/vercel-runtime';
  mkdirSync(output,{recursive:true});
  const config=JSON.parse(readFileSync('tsconfig.json','utf8'));
  config.compilerOptions={...config.compilerOptions,module:'NodeNext',moduleResolution:'NodeNext',noEmit:false,allowImportingTsExtensions:false,rootDir:'../..',outDir:'./compiled'};
  config.include=['../../api/**/*.ts'];
  writeFileSync(output+'/tsconfig.json',JSON.stringify(config));
  execFileSync(process.execPath,['node_modules/typescript/bin/tsc','--project',output+'/tsconfig.json'],{stdio:'pipe'});
  const script=`
    import assert from 'node:assert/strict';
    import health from './compiled/api/health.js';
    import status from './compiled/api/refinement/status.js';
    import refine from './compiled/api/refine.js';
    import translate from './compiled/api/translate.js';
    for(const key of ['GEMINI_API_KEY','OPENAI_API_KEY','GROQ_API_KEY'])delete process.env[key];
    const origin='https://classcraft-test.example';
    assert.equal((await health.fetch(new Request(origin+'/api/health'))).status,200);
    assert.equal((await (await status.fetch(new Request(origin+'/api/refinement/status'))).json()).available,false);
    assert.equal((await refine.fetch(new Request(origin+'/api/refine'))).status,405);
    assert.equal((await translate.fetch(new Request(origin+'/api/translate'))).status,405);
    console.log('Node ESM API smoke test passed');
  `;
  writeFileSync(output+'/smoke.mjs',script);
  const result=execFileSync(process.execPath,[resolve(output+'/smoke.mjs')],{encoding:'utf8'});
  expect(result).toContain('Node ESM API smoke test passed');
},30000);
