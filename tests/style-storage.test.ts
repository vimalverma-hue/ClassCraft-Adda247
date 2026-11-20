import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {newProject} from '../src/model';
import {makeStylePreset} from '../src/stylePresets';
import {createProjectWithDefault,getStyleLibrary,saveStyleLibrary,saveProject,restoreProject,validateProject} from '../src/storage';
import {validateFontAsset} from '../src/fonts';
import {nativeText} from '../src/nativeText';

it('persists styles independently of the current project and restores the default in the next class',async()=>{
 const p=newProject();p.style.size=32;p.style.questionGap=62;p.theme.headerText='SSC | हिंदी';const preset=makeStylePreset(p,p.slides[4],'Daily class');
 await saveStyleLibrary([preset],preset.id);
 await saveProject(newProject());
 const lib=await getStyleLibrary();expect(lib.presets[0].name).toBe('Daily class');expect(lib.defaultId).toBe(preset.id);
 const next=await createProjectWithDefault();expect(next.theme.headerText).toBe('SSC | हिंदी');expect(next.style.size).toBe(32);expect(next.style.questionGap).toBe(62);expect(next.slides.every(s=>s.style.questionGap===62)).toBe(true);expect(next.slides).toHaveLength(7);
 next.slides[0].correctOption=2;next.slides[0].answerReveal=true;await saveProject(next);
 const restored=await restoreProject();expect(restored?.theme.headerText).toBe(next.theme.headerText);expect(restored?.slides[0].correctOption).toBe(2);
 await saveStyleLibrary([preset],'');expect((await createProjectWithDefault()).style.size).toBe(26);
});
it('rejects invalid font data in project and style assets before registering CSS',()=>{
 const invalid={family:'Kokila',weight:700,name:'bad.ttf',data:'data:font/ttf;base64,ABC);color:red'};
 expect(()=>validateFontAsset(invalid)).toThrow('Invalid Kokila');
 const p=newProject();p.fonts={kokilaBold:invalid as any};expect(()=>validateProject(p)).toThrow('Invalid Kokila');
});
it('uses Noto Latin runs for native PowerPoint labels while retaining Hindi and highlighted text',()=>{
 const text='B) नई दिल्ली — New Delhi';
 const runs=nativeText({id:'option-1',kind:'text',x:0,y:0,w:100,h:100,text,font:'Noto Sans Devanagari',highlight:'New Delhi',highlightColor:'#ffff00'});
 expect(runs.map(r=>r.text).join('')).toBe(text);
 expect(runs[0].options?.fontFace).toBe('Noto Sans');
 expect(runs.some(r=>r.text.includes('दिल्ली')&&r.options?.fontFace==='Noto Sans Devanagari')).toBe(true);
 expect(runs.find(r=>r.text==='New Delhi')?.options?.highlight).toBe('ffff00');
 const kokila=nativeText({id:'q',kind:'text',x:0,y:0,w:100,h:100,text,font:'Kokila'});expect(kokila).toEqual([{text}]);
});
