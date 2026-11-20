import {it,expect,vi} from 'vitest';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ensureProjectFonts} from '../src/fonts';
import {newProject} from '../src/model';

it('loads the supplied Kokila Bold, Mangal and Aptos Bold fonts without an installed font or repeated upload',async()=>{
 const old=(globalThis as any).document,load=vi.fn(async()=>[]);
 (globalThis as any).document={fonts:{load,ready:Promise.resolve()},getElementById:()=>null};
 try{
  const project=newProject();project.style.font='Kokila';
  await expect(ensureProjectFonts(project)).resolves.toBeUndefined();
  expect(load).toHaveBeenCalledWith('700 52px "Kokila"',expect.any(String));
  const data=fs.readFileSync('public/fonts/kokilab.ttf');
  expect(data.readUInt32BE(0)).toBe(0x10000);expect(data.length).toBe(202196);
  expect(fs.readFileSync('src/styles.css','utf8')).toContain('src:url("/fonts/kokilab.ttf")');
  expect(load).toHaveBeenCalledWith('700 52px "Mangal"',expect.any(String));
  const mangal=fs.readFileSync('public/fonts/mangalb.ttf');
  expect(mangal.readUInt32BE(0)).toBe(0x10000);expect(mangal.length).toBe(169208);
  expect(fs.readFileSync('src/styles.css','utf8')).toContain('src:url("/fonts/mangalb.ttf")');
  expect(load).toHaveBeenCalledWith('700 52px "Aptos"',expect.any(String));
  const aptos=fs.readFileSync('public/fonts/aptos-bold.ttf');
  expect(createHash('sha256').update(aptos).digest('hex')).toBe('e59d983f8752146b8d02df5cad8f545ce677ef71dbe113afa3b395a9088c7f53');
  expect(fs.readFileSync('src/styles.css','utf8')).toContain('src:url("/fonts/aptos-bold.ttf")');
 }finally{(globalThis as any).document=old;}
});
