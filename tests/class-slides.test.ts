import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {openDB} from 'idb';
import {newProject,blankSlide,setVariant,type TemplateSet} from '../src/model';
import {ensureClassSlides,fixedSlot,insertionPosition,moveContentSlide} from '../src/classSlides';
import {createMCQDeck} from '../src/mcqSlides';
import {generateSlides} from '../src/parser';
import {resolveSlide} from '../src/layout';
import {saveProject,restoreProject} from '../src/storage';
import {exportDeck} from '../src/exporter';
import {applyLabelColour} from '../src/labelColour';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
const question=(i:number)=>`${i}. भारत की राजधानी क्या है?\nA) मुंबई\nB) नई दिल्ली\nC) जयपुर\nD) चेन्नई\nAnswer: B`;
function order(p:ReturnType<typeof newProject>){expect(fixedSlot(p.slides[0])).toBe('welcome');expect(fixedSlot(p.slides[1])).toBe('thumbnail');expect(fixedSlot(p.slides.at(-1)!)).toBe('closing');expect(p.slides.filter(s=>fixedSlot(s))).toHaveLength(3);}

it('adds 3 original slides to a 20-MCQ deck without changing any question or answer',()=>{
 const p=newProject();p.source=Array.from({length:20},(_,i)=>question(i+1)).join('\n');p.includeWelcome=false;p.includeClosing=false;const raw=createMCQDeck(p,templates).project,deck=ensureClassSlides(raw,p);order(deck);expect(deck.slides).toHaveLength(23);expect(deck.slides.slice(2,-1)).toEqual(raw.slides);expect(deck.source).toBe(p.source);expect(deck.includeWelcome&&deck.includeClosing).toBe(true);
 expect(ensureClassSlides(deck).slides.map(s=>s.id)).toEqual(deck.slides.map(s=>s.id));
});
it('preserves an uploaded thumbnail and its edits when extracting or regenerating all content',()=>{
 const p=ensureClassSlides(newProject());p.source=question(1);p.slides[1].image='my-thumbnail';p.slides[1].edits['template-0']='My thumbnail';const raw=createMCQDeck(p,templates).project;const next=ensureClassSlides(raw,p);expect(next.slides[1]).toEqual(p.slides[1]);
 const all=ensureClassSlides({...next,slides:generateSlides(next).filter(s=>!fixedSlot(s))},next);order(all);expect(all.slides[1].image).toBe('my-thumbnail');expect(all.slides[1].edits['template-0']).toBe('My thumbnail');
});
it('uses matching Dark and Light originals for Welcome, Thumbnail and Thank you',()=>{
 const p=ensureClassSlides(newProject());for(const variant of ['dark','light'] as const){const deck=ensureClassSlides(setVariant(p,variant));order(deck);for(const i of [0,deck.slides.length-1]){const r=resolveSlide(deck,deck.slides[i],templates,i);expect(r.elements.find(e=>e.kind==='image')?.src).toContain('/'+variant+'/');}expect(resolveSlide(deck,deck.slides[1],templates,1).elements[0].text).toBe('Paste Your Thumbnail');}
});
it('keeps insertion and content moves between the fixed opening and closing slides',()=>{
 const p=ensureClassSlides(newProject());expect(insertionPosition(p,0)).toBe(2);expect(insertionPosition(p,p.slides.length-1)).toBe(p.slides.length-1);
 expect(moveContentSlide(p,0,4).project).toBe(p);expect(moveContentSlide(p,1,4).project).toBe(p);expect(moveContentSlide(p,p.slides.length-1,2).project).toBe(p);
 const start=moveContentSlide(p,4,0);order(start.project);expect(start.active).toBe(2);expect(start.project.slides[2].id).toBe(p.slides[4].id);
 const end=moveContentSlide(p,2,99);order(end.project);expect(end.active).toBe(p.slides.length-2);expect(end.project.slides.at(-2)!.id).toBe(p.slides[2].id);
 const inserted=ensureClassSlides({...p,slides:[...p.slides,blankSlide()]});order(inserted);expect(inserted.slides.at(-2)?.kind).toBe('teaching');
});
it('upgrades an already-saved old deck on restore without regenerating its MCQs',async()=>{
 const p=newProject();p.source=question(1);const raw=createMCQDeck(p,templates).project;await saveProject(newProject());const db=await openDB('classslide-studio',1);await db.put('projects',raw);await db.put('meta',raw.id,'active');const restored=(await restoreProject())!;order(restored);expect(restored.slides).toHaveLength(4);expect(restored.slides[2]).toEqual(raw.slides[0]);await saveProject(restored);expect((await restoreProject())!.slides.map(s=>s.id)).toEqual(restored.slides.map(s=>s.id));db.close();
});
it('exports Welcome, Thumbnail, two MCQs and Thank you in both themes with click answers on slides 3 and 4',async()=>{
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const t=structuredClone(templates);for(const variant of ['dark','light'] as const)for(const slide of t[variant].slides)for(const item of slide.items)if(item.src)item.src='data:image/jpeg;base64,'+fs.readFileSync('public'+item.src).toString('base64');
  const dom=new JSDOM().window;fs.mkdirSync('test-output',{recursive:true});
  for(const variant of ['dark','light'] as const){const p=setVariant(newProject(),variant);p.source=question(1)+'\n\n'+question(2);const deck=applyLabelColour(ensureClassSlides(createMCQDeck(p,t).project,p),'#e21b2e');const blob=await exportDeck(deck,t,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:true},()=>{}),bytes=await blob.arrayBuffer(),zip=await JSZip.loadAsync(bytes);
   for(let n=1;n<=5;n++){const doc=new dom.DOMParser().parseFromString(await zip.file(`ppt/slides/slide${n}.xml`)!.async('string'),'application/xml');expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);expect(doc.getElementsByTagNameNS('*','timing')).toHaveLength([3,4].includes(n)?1:0);const text=[...doc.getElementsByTagNameNS('*','t')].map(e=>e.textContent).join('');if(n===2)expect(text).toBe('Paste Your Thumbnail');if([1,5].includes(n)){expect(text).toBe('');expect(doc.getElementsByTagNameNS('*','pic')).toHaveLength(1);}if([3,4].includes(n)){expect(text).toContain('नई दिल्ली');const coloured=[...doc.getElementsByTagNameNS('*','r')].filter(e=>e.getElementsByTagNameNS('*','srgbClr')[0]?.getAttribute('val')?.toLowerCase()===(variant==='dark'?'e84857':'e21b2e')).map(e=>e.getElementsByTagNameNS('*','t')[0]?.textContent);expect(coloured).toContain(String(n-2)+'.');expect(coloured).toContain('A)');expect(coloured).toContain('B)');expect(coloured).not.toContain('नई');}}
   expect(zip.file('ppt/slides/slide6.xml')).toBeNull();fs.writeFileSync(`test-output/class-order-${variant}.pptx`,Buffer.from(bytes));
  }
 }finally{(globalThis as any).document=prior;}
});
