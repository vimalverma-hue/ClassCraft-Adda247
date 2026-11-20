import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {blankSlide,newProject,type TemplateSet} from '../src/model';
import {resolveSlide} from '../src/layout';
import {makeStylePreset,applyStylePreset} from '../src/stylePresets';
import {exportDeck} from '../src/exporter';

const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
function sample(){
 const p=newProject();p.theme.mode='custom';p.style.font='Mangal';p.style.bold=false;p.style.labelColor='#ffff00';
 p.slides=[{...blankSlide(),layout:'mcq',optionsMode:'vertical',text:'Q.1 जनजाति का नाम चुनिए / Choose the tribe.\nA. ज़ुलू / Zulu\nB. योरूबा / Yoruba\nC. मासाई / Maasai\nD. हिम्बा / Himba'}];
 return p;
}
function options(p:ReturnType<typeof sample>){return resolveSlide(p,p.slides[0],templates,0).elements.filter(e=>e.id.startsWith('option-'));}

it('compacts existing single-line MCQ options without reducing font size, with a clear question gap',()=>{
 const p=sample(),r=resolveSlide(p,p.slides[0],templates,0),o=options(p),q=r.elements.find(e=>e.id==='question')!;
 expect(p.style.optionGap).toBeUndefined();
 expect(o[0].y-q.y-q.h).toBeCloseTo(36);
 expect(o[1].y-o[0].y).toBeLessThan(p.style.optionSize*2*p.style.lineHeight+p.style.paragraphGap);
 for(let i=0;i<o.length;i++){
  expect(o[i].size).toBe(p.style.optionSize);expect(o[i].font).toBe('Mangal');expect(o[i].bold).toBe(true);
  if(i)expect(o[i].y-o[i-1].y-o[i-1].h).toBeCloseTo(8);
 }
 expect(r.warnings).toEqual([]);
});

it('uses edited bilingual line heights and the longest option in each column row',()=>{
 for(const mode of ['vertical','columns'] as const){
  const p=sample();p.slides[0].optionsMode=mode;
  p.slides[0].edits['option-0']='A. पानी का द्रव्यमान मापना / Measuring the mass of water\nदूसरी पंक्ति / Second line';
  const o=options(p),next=mode==='vertical'?o[1]:o[2];
  expect(o[0].lines!.length).toBeGreaterThan(1);expect(o[0].lineHeight).toBeGreaterThanOrEqual(1.35);
  expect(o[0].h).toBeCloseTo(o[0].lines!.length*p.style.optionSize*2*o[0].lineHeight!);
  expect(next.y).toBeCloseTo(o[0].y+o[0].h+8);
  expect(resolveSlide(p,p.slides[0],templates,0).warnings).toEqual([]);
 }
});

it('retains Mangal and the independent option gap in saved styles and selected-slide scope',()=>{
 const p=sample();p.slides[0].style.optionGap=4;const preset=makeStylePreset(p,p.slides[0],'Compact Mangal');
 const restored=applyStylePreset(sample(),JSON.parse(JSON.stringify(preset)),0),o=options(restored);
 expect(restored.slides[0].style.font).toBe('Mangal');expect(o[1].y-o[0].y-o[0].h).toBeCloseTo(4);
 expect(restored.style.paragraphGap).toBe(16);expect(restored.style.optionGap).toBeUndefined();
});

it('exports Mangal and Aptos bold faces and matching compact option spacing in editable PowerPoint',async()=>{
 const prior=(globalThis as any).document;
 (globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const p=sample();p.slides[0].correctOption=1;p.slides[0].answerReveal=true;
  p.slides.push({...p.slides[0],id:'light-kokila',style:{font:'Kokila'},theme:{variant:'light',background:'#ffffff',textColor:'#171925'}});
  p.slides.push({...p.slides[0],id:'aptos',style:{font:'Aptos',bold:false}});
  const blob=await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:true},()=>{});
  const bytes=await blob.arrayBuffer(),zip=await JSZip.loadAsync(bytes),xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
  const doc=new JSDOM(xml,{contentType:'text/xml'}).window.document;
  const text=[...doc.getElementsByTagNameNS('*','sp')].filter(n=>n.textContent?.includes('Zulu'));
  expect(text.length).toBeGreaterThan(0);
  expect(text[0].getElementsByTagNameNS('*','latin')[0].getAttribute('typeface')).toBe('Mangal');
  expect([...text[0].getElementsByTagNameNS('*','rPr')].every(n=>n.getAttribute('b')==='1')).toBe(true);
  expect(text[0].getElementsByTagNameNS('*','spcPts')[0].getAttribute('val')).toBe('2880');
  const aptosDoc=new JSDOM(await zip.file('ppt/slides/slide3.xml')!.async('string'),{contentType:'text/xml'}).window.document;
  const aptosOptions=[...aptosDoc.getElementsByTagNameNS('*','sp')].filter(n=>n.textContent?.includes('Zulu'));
  expect(aptosOptions.length).toBeGreaterThan(0);
  for(const shape of aptosOptions){
   expect([...shape.getElementsByTagNameNS('*','latin')].every(n=>n.getAttribute('typeface')==='Aptos')).toBe(true);
   expect([...shape.getElementsByTagNameNS('*','rPr')].every(n=>n.getAttribute('b')==='1')).toBe(true);
  }
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/mangal-compact-options.pptx',Buffer.from(bytes));
 }finally{(globalThis as any).document=prior;}
});
