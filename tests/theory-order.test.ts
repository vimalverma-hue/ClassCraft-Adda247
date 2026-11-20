import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {blankSlide,newProject,type TemplateSet} from '../src/model';
import {resolveSlide} from '../src/layout';
import {paginateTheory} from '../src/theory';
import {theoryLanguageEntries,applyTheoryLanguageEntries} from '../src/theoryLanguages';
import {nativeText} from '../src/nativeText';
import {editingTextRuns} from '../src/textHighlight';
import {exportDeck} from '../src/exporter';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
function sample(bullets=true){const p=newProject();p.theme.mode='custom';p.style={...p.style,hindiFont:'Mangal',englishFont:'Aptos',bullets,headingColor:'#00e6cc',bulletColor:'#ffff00'};p.slides=[{...blankSlide(),layout:'theory',theory:{title:'संविधान\nConstitution'},text:'संविधान सर्वोच्च कानून है।\nThe Constitution is the supreme law.\n\nयह 1950 में लागू हुआ। / It came into effect in 1950.'}];return p;}
it.each([true,false])('orders each theory heading and point independently, preserving geometry, fonts and edits (bullets=%s)',bullets=>{
 const p=sample(bullets),s=p.slides[0],source=structuredClone(s);let initialHeight=0;
 for(const order of ['hi-first','en-first','hi-first'] as const){
  s.style.questionLanguageOrder=order;const r=resolveSlide(p,s,templates,0);expect(r.warnings).toEqual([]);
  for(const id of ['theory-title','theory-item-0','theory-item-1']){
   const hi=r.elements.find(e=>e.id===id)!,en=r.elements.find(e=>e.id===id+'-en')!;
   const [first,second]=order==='en-first'?[en,hi]:[hi,en];expect(second.y-first.y-first.h).toBeCloseTo(8);
   expect(first.editText).toBe(first.text+'\n'+second.text);expect(second.editId).toBe(id);
   expect(editingTextRuns(first).map(run=>run.text).join('')).toBe(first.editText);
   expect(nativeText(hi).some(run=>run.options?.fontFace==='Mangal')).toBe(true);expect(nativeText(en).some(run=>run.options?.fontFace==='Aptos')).toBe(true);
   if(id==='theory-title')expect(hi.color).toBe('#00e6cc');
   else if(bullets){const marker=r.elements.find(e=>e.id===id.replace('item','bullet'))!;expect(marker.y).toBe(first.y);expect(marker.color).toBe('#ffff00');}
  }
  const body=r.elements.filter(e=>e.id.startsWith('theory-')),bottom=Math.max(...body.map(e=>e.y+e.h));if(!initialHeight)initialHeight=bottom;expect(bottom).toBeCloseTo(initialHeight);
  expect(s.text).toBe(source.text);expect(s.theory).toEqual(source.theory);expect(s.edits).toEqual(source.edits);
 }
});
it('honours direct theory edits and keeps single-language text and equations intact',()=>{
 const p=sample(),s=p.slides[0];s.style.questionLanguageOrder='en-first';s.edits['theory-title']='New heading\nनया शीर्षक';s.edits['theory-item-0']='नया बिंदु / New point';s.text+='\n\nOnly English.\n\nकेवल हिंदी।\n\n$$x=2$$';
 const r=resolveSlide(p,s,templates,0);expect(r.elements.find(e=>e.id==='theory-title-en')!.editText).toBe('New heading\nनया शीर्षक');expect(r.elements.find(e=>e.id==='theory-item-0-en')!.text).toBe('New point');
 expect(r.elements.filter(e=>/^theory-item-[234]$/.test(e.id)).map(e=>e.text)).toEqual(['Only English.','केवल हिंदी।','x=2']);expect(r.elements.some(e=>e.id==='theory-item-2-en')).toBe(false);
});
it('retains both cached languages through conversion and long-content pagination in either order',()=>{
 let p=sample();p.style.questionLanguageOrder='en-first';p=applyTheoryLanguageEntries(p,theoryLanguageEntries(p),'both');const before=theoryLanguageEntries(p).map(e=>e.data);
 for(const s of p.slides.filter(s=>s.layout==='theory'))resolveSlide(p,s,templates,0);expect(theoryLanguageEntries(p).map(e=>e.data)).toEqual(before);
 p=applyTheoryLanguageEntries(p,theoryLanguageEntries(p),'hi');expect(resolveSlide(p,p.slides[2],templates,2).elements.some(e=>e.id==='theory-title-en')).toBe(false);
 p=applyTheoryLanguageEntries(p,theoryLanguageEntries(p),'both');const r=resolveSlide(p,p.slides[2],templates,2);expect(r.elements.find(e=>e.id==='theory-title-en')!.y).toBeLessThan(r.elements.find(e=>e.id==='theory-title')!.y);
 const long=sample(false),s=long.slides[0];s.text=Array.from({length:20},(_,i)=>`यह बिंदु ${i} है।\nThis is point ${i} about the Constitution and rights of citizens.`).join('\n\n');let count=0;
 for(const order of ['hi-first','en-first'] as const){long.style.questionLanguageOrder=order;const pages=paginateTheory(long,s);if(!count)count=pages.length;expect(count).toBeGreaterThan(1);expect(pages).toHaveLength(count);for(const page of pages)expect(resolveSlide(long,page,templates,0).warnings).toEqual([]);}
});
it('exports both heading and body orders with preview positions and fonts in dark/light PPT',async()=>{
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const p=sample(),seed=p.slides[0];p.slides=[];
  for(const variant of ['dark','light'] as const)for(const order of ['hi-first','en-first'] as const)p.slides.push({...structuredClone(seed),style:{questionLanguageOrder:order},theme:{variant,background:variant==='dark'?'#191b1c':'#ffffff',textColor:variant==='dark'?'#ffffff':'#171925'}});
  const zip=await JSZip.loadAsync(await(await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false},()=>{})).arrayBuffer());
  for(const [i,s] of p.slides.entries()){
   const doc=new JSDOM(await zip.file(`ppt/slides/slide${i+1}.xml`)!.async('string'),{contentType:'text/xml'}).window.document,r=resolveSlide(p,s,templates,i);
   for(const e of r.elements.filter(e=>/^theory-(title|item)/.test(e.id))){
    const shape=[...doc.getElementsByTagNameNS('*','sp')].find(shape=>shape.getElementsByTagNameNS('*','cNvPr')[0]?.getAttribute('name')==='ClassSlide Text '+e.id)!;
    expect([...shape.getElementsByTagNameNS('*','t')].map(n=>n.textContent).join('')).toBe(e.lines!.join('\n'));
    expect(Number(shape.getElementsByTagNameNS('*','off')[0].getAttribute('y'))/6350).toBeCloseTo(e.y,3);
    expect([...shape.getElementsByTagNameNS('*','latin')].some(n=>n.getAttribute('typeface')===(e.id.endsWith('-en')?'Aptos':'Mangal'))).toBe(true);
   }
  }
 }finally{(globalThis as any).document=prior;}
});
