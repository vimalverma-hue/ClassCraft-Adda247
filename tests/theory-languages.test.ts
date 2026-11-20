import 'fake-indexeddb/auto';
import {it,expect,vi} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {newProject,type TemplateSet} from '../src/model';
import {prepareTheoryLanguageProject,theoryLanguageEntries,theoryMissingDirections,translateTheoryEntries,applyTheoryLanguageEntries,theoryTranslationWarnings} from '../src/theoryLanguages';
import {prepareLanguageProject} from '../src/languages';
import {theoryContent} from '../src/theory';
import {resolveSlide} from '../src/layout';
import {exportDeck} from '../src/exporter';
import {saveProject,restoreProject,exportProject,importProject} from '../src/storage';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
const source='# संविधान\n\nसंविधान सर्वोच्च कानून है।\n\nयह 1950 में लागू हुआ।';
const dictionary:Record<string,string>={'संविधान':'Constitution','संविधान सर्वोच्च कानून है।':'The Constitution is the supreme law.','यह 1950 में लागू हुआ।':'It came into effect in 1950.'};
const signal=()=>new AbortController().signal;
function project(){const p=newProject();p.source=source;return prepareTheoryLanguageProject(p,templates,'source','theory-bullets');}
async function translated(){const p=project();return applyTheoryLanguageEntries(p,await translateTheoryEntries(theoryLanguageEntries(p),'both',async text=>dictionary[text],signal(),()=>{}),'both');}
it('converts headings and bullet paragraphs, keeps source and fixed slides, and reuses both translations',async()=>{
 let p=await translated();const s=p.slides[2];expect(s.theory?.title).toBe('संविधान\nConstitution');expect(theoryContent(s)).toEqual(['संविधान सर्वोच्च कानून है।\nThe Constitution is the supreme law.','यह 1950 में लागू हुआ।\nIt came into effect in 1950.']);expect(s.style.bullets).toBe(true);expect(p.source).toBe(source);expect(p.slides.map(s=>s.fixedSlot)).toEqual(['welcome','thumbnail',undefined,'closing']);
 const noNetwork=vi.fn(async()=>{throw Error('Should reuse translations');});for(const mode of ['en','hi','both'] as const){const entries=theoryLanguageEntries(p);expect(theoryMissingDirections(entries,mode)).toEqual([]);p=applyTheoryLanguageEntries(p,await translateTheoryEntries(entries,mode,noNetwork,signal(),()=>{}),mode);if(mode==='en')expect(p.slides[2].text).not.toMatch(/[\u0900-\u097f]/);if(mode==='hi')expect(p.slides[2].text).not.toContain('Constitution');}expect(noNetwork).not.toHaveBeenCalled();
});
it('reflows longer bilingual theory across slides and restores complete cached pairs without duplicated content',async()=>{
 const p=newProject();p.source='# संविधान\n\n'+Array.from({length:16},(_,i)=>'यह बिंदु '+i+' है।').join('\n\n');const prepared=prepareTheoryLanguageProject(p,templates,'source','theory-paragraphs'),originalCount=prepared.slides.length;
 const entries=await translateTheoryEntries(theoryLanguageEntries(prepared),'both',async text=>text==='संविधान'?'Constitution':'This is teaching point '+text.match(/\d+/)?.[0]+' with a much longer explanation about the constitutional rights and duties of citizens.',signal(),()=>{});
 const result=applyTheoryLanguageEntries(prepared,entries,'both');expect(result.slides.length).toBeGreaterThan(originalCount);for(const s of result.slides.filter(s=>s.layout==='theory'))expect(resolveSlide(result,s,templates,0).warnings).toEqual([]);
 const cached=theoryLanguageEntries(result);expect(cached.map(e=>e.data)).toEqual(entries.map(e=>e.data));expect(theoryMissingDirections(cached,'en')).toEqual([]);const english=applyTheoryLanguageEntries(result,cached,'en');const text=english.slides.filter(s=>s.layout==='theory').flatMap(theoryContent).join(' ');for(let i=0;i<16;i++)expect(text.match(new RegExp('teaching point '+i+' with','g'))).toHaveLength(1);expect(english.slides.filter(s=>s.layout==='theory').every(s=>s.style.bullets===false)).toBe(true);
});
it('keeps MCQ answers and unrelated slides when converting current theory slides and uses canvas edits',async()=>{
 let p=await translated();const q=newProject();q.source='Q.9 Capital?\nA) Delhi\nB) Mumbai\nAnswer: A';const mcq=prepareLanguageProject(q,templates,'source').slides[2];p.slides.splice(3,0,mcq);p.slides[2].edits['theory-title']='नया शीर्षक';p.slides[2].edits['theory-item-0']='नया बिंदु';const entries=theoryLanguageEntries(p);expect(entries[0].data.title).toEqual({hi:'नया शीर्षक'});expect(entries[0].data.items[0]).toEqual({hi:'नया बिंदु'});const next=applyTheoryLanguageEntries(p,entries,'hi');expect(next.slides.find(s=>s.id===mcq.id)).toEqual(mcq);expect(next.slides[2].text).toContain('नया बिंदु');
 p.slides[2].locked=true;expect(()=>prepareTheoryLanguageProject(p,templates,'slides')).toThrow('Unlock');
});
it('keeps original theory unchanged on failure/cancel and validates missing translations and numeric differences',async()=>{
 const p=project(),before=structuredClone(p),entries=theoryLanguageEntries(p);let count=0;await expect(translateTheoryEntries(entries,'both',async()=>{if(++count>1)throw Error('quota');return 'Constitution';},signal(),()=>{})).rejects.toThrow('quota');expect(p).toEqual(before);expect(entries[0].data.title?.en).toBeUndefined();const controller=new AbortController();controller.abort();await expect(translateTheoryEntries(entries,'both',async()=>'',controller.signal,()=>{})).rejects.toThrow();expect(()=>applyTheoryLanguageEntries(p,entries,'en')).toThrow('Complete');expect(theoryTranslationWarnings({items:[{hi:'1950',en:'1947'}]})).toHaveLength(1);
});
it('persists theory translation groups through browser storage and project ZIP',async()=>{
 const p=await translated();await saveProject(p);const restored=(await restoreProject())!;expect(theoryLanguageEntries(restored)).toEqual(theoryLanguageEntries(p));const blob=await exportProject(p),copy=await importProject({size:blob.size,arrayBuffer:()=>blob.arrayBuffer()} as File);expect(theoryMissingDirections(theoryLanguageEntries(copy),'en')).toEqual([]);
});
it('exports both theory languages as editable text with bullet formatting',async()=>{
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};try{const t=structuredClone(templates);for(const variant of ['dark','light'] as const)for(const slide of t[variant].slides)for(const item of slide.items)if(item.src)item.src='data:image/jpeg;base64,'+fs.readFileSync('public'+item.src).toString('base64');const p=await translated();const blob=await exportDeck(p,t,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:true},()=>{}),zip=await JSZip.loadAsync(await blob.arrayBuffer()),xml=await zip.file('ppt/slides/slide3.xml')!.async('string');expect(xml).toContain('Constitution');expect(xml).toContain('संविधान');expect(xml).toContain('1950');expect(xml).toContain('•');}finally{(globalThis as any).document=prior;}
});
