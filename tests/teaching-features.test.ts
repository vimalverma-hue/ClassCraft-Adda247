import {describe,it,expect,beforeAll} from 'vitest';
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import JSZip from 'jszip';
import {newProject,setVariant,blankSlide,type TemplateSet} from '../src/model';
import {generateSlides} from '../src/parser';
import {resolveSlide} from '../src/layout';
import {answerOptions,answerOverlay,revealAnswer} from '../src/answers';
import {makeStylePreset,applyStylePreset,validateStylePreset} from '../src/stylePresets';
import {appearTiming,addAnswerAnimations} from '../src/animations';
import {exportDeck} from '../src/exporter';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
function sample(){const p=newProject();p.source='1. भारत की राजधानी क्या है?\nA) मुंबई\nB) नई दिल्ली\nC) जयपुर\nD) चेन्नई';p.includeWelcome=false;p.includeClosing=false;p.slides=generateSlides(p);return p;}
describe('teacher controls',()=>{
 it('never automatically marks an answer',()=>{const p=sample(),s=p.slides[0];expect(answerOptions(s)).toHaveLength(4);expect(s.correctOption).toBeUndefined();expect(answerOverlay(s,resolveSlide(p,s,templates,0))).toBeUndefined();});
 it('keeps correct option hidden until reveal',()=>{const p=sample(),s=p.slides[0];s.correctOption=1;s.answerReveal=true;const r=resolveSlide(p,s,templates,0);expect(r.elements.some(e=>e.id==='answer-reveal')).toBe(false);const revealed=revealAnswer(s,r);expect(revealed.elements.at(-1)?.text).toBe('B) नई दिल्ली');expect(revealed.elements.at(-1)?.fill).toBe('#86efac');});
 it('uses edited option wording and selected highlight colour',()=>{const p=sample(),s=p.slides[0];s.correctOption=1;s.answerReveal=true;s.answerColor='#ffff00';s.edits['option-1']='B) New Delhi — नई दिल्ली';const e=answerOverlay(s,resolveSlide(p,s,templates,0));expect(e?.text).toBe(s.edits['option-1']);expect(e?.fill).toBe('#ffff00');});
 it('does not reveal unmarked, invalid or disabled answers',()=>{const p=sample(),s=p.slides[0];s.correctOption=99;s.answerReveal=true;expect(answerOverlay(s,resolveSlide(p,s,templates,0))).toBeUndefined();s.correctOption=1;s.answerReveal=false;expect(answerOverlay(s,resolveSlide(p,s,templates,0))).toBeUndefined();});
 it('adds editable text to original teaching headers without duplicating a logo',()=>{const p=newProject();p.theme.headerText='भारतीय संविधान | SSC';const r=resolveSlide(p,p.slides[4],templates,4);expect(r.elements.filter(e=>e.kind==='image')).toHaveLength(1);const h=r.elements.find(e=>e.id==='heading')!;expect(h.text).toBe(p.theme.headerText);expect(h.editable).toBe(true);expect(h.x+h.w).toBeLessThan(1630);});
 it('avoids the baked Home Work label',()=>{const p=newProject();p.theme.headerText='Practice questions';const h=resolveSlide(p,p.slides[5],templates,5).elements.find(e=>e.id==='heading')!;expect(h.x).toBeGreaterThanOrEqual(560);});
 it('preserves earlier chapter headers in old projects and lets an explicit empty value clear them',()=>{const p=sample();delete p.theme.headerText;p.theme.chapter='Chapter 1';expect(resolveSlide(p,p.slides[0],templates,0).elements.some(e=>e.text==='Chapter 1')).toBe(true);p.theme.headerText='';expect(resolveSlide(p,p.slides[0],templates,0).elements.some(e=>e.id==='heading')).toBe(false);});
 it('saves and reapplies a style without replacing content, answer or manual edits',()=>{const p=sample(),s=p.slides[0];s.style={font:'Kokila',bold:true,size:30};s.reserve='right';p.theme.headerText='My header';const preset=makeStylePreset(p,s,'Hindi class');validateStylePreset(preset);const next=sample();next.slides[0].correctOption=2;next.slides[0].edits.question='Edited';const applied=applyStylePreset(next,preset);expect(applied.style.font).toBe('Kokila');expect(applied.theme.headerText).toBe('My header');expect(applied.slides[0].blocks).toEqual(next.slides[0].blocks);expect(applied.slides[0].correctOption).toBe(2);expect(applied.slides[0].edits.question).toBe('Edited');expect(applied.slides[0].reserve).toBe('right');});
 it('preset scope only changes the selected slide',()=>{const p=sample(),pr=makeStylePreset(p,p.slides[0],'Style');pr.style.size=32;const next=newProject();const applied=applyStylePreset(next,pr,3);expect(applied.slides[3].style.size).toBe(32);expect(applied.slides[2].style.size).toBeUndefined();expect(applied.style.size).toBe(26);});
 it('switches original-template automatic text colour after applying a style',()=>{const p=sample();const pr=makeStylePreset(p,p.slides[0],'Dark');const next=setVariant(applyStylePreset(p,pr),'light');const r=resolveSlide(next,next.slides[0],templates,0);expect(r.elements.find(e=>e.id==='question')?.color).toBe('#171925');});
 it.each(['Kokila','Mangal','Aptos'])('%s uses genuine bold text attributes in the resolved model',font=>{const p=sample();p.style.font=font;p.style.bold=false;const r=resolveSlide(p,p.slides[0],templates,0);expect(r.elements.filter(e=>e.kind==='text').every(e=>e.bold)).toBe(true);});
});
describe('PowerPoint click-to-reveal XML',()=>{
 it('uses a native clickEffect entrance with a visibility change and correct target',()=>{const xml=appearTiming('42');expect(xml).toContain('nodeType="clickEffect"');expect(xml).toContain('presetClass="entr"');expect(xml).toContain('style.visibility');expect(xml).toContain('spid="42"');expect(()=>appearTiming('bad')).toThrow();expect(appearTiming('42',true)).not.toContain('<p:bldP');});
 it('rejects missing answer shapes instead of silently losing the animation',async()=>{const z=new JSZip();z.file('ppt/slides/slide1.xml','<p:sld/>');await expect(addAnswerAnimations(await z.generateAsync({type:'arraybuffer'}),[{index:0,picture:false}])).rejects.toThrow('Answer highlight shape');});
 it('exports an editable animated PPTX with one real animation targeting its answer shape',async()=>{
  const old=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
  try{const p=sample();p.theme.mode='custom';p.theme.headerText='SSC | भारतीय संविधान';p.slides[0].correctOption=1;p.slides[0].answerReveal=true;const blob=await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:true},()=>{});const bytes=await blob.arrayBuffer();const zip=await JSZip.loadAsync(bytes),xml=await zip.file('ppt/slides/slide1.xml')!.async('string');const dom=new JSDOM().window;const doc=new dom.DOMParser().parseFromString(xml,'application/xml');expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);const target=doc.getElementsByTagNameNS('*','spTgt')[0].getAttribute('spid');const shape=[...doc.getElementsByTagNameNS('*','cNvPr')].find(e=>e.getAttribute('name')==='ClassSlide Answer Reveal');expect(shape?.getAttribute('id')).toBe(target);expect(doc.getElementsByTagNameNS('*','timing')).toHaveLength(1);expect([...doc.getElementsByTagNameNS('*','t')].map(n=>n.textContent).join('')).toContain('SSC | भारतीय संविधान');fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/click-answer.pptx',Buffer.from(bytes));
   const plain=await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:false},()=>{});const zp=await JSZip.loadAsync(await plain.arrayBuffer());const noAnim=await zp.file('ppt/slides/slide1.xml')!.async('string');expect(noAnim).not.toContain('ClassSlide Answer Reveal');expect(noAnim).not.toContain('<p:timing');
  }finally{(globalThis as any).document=old;}
 });
});

it('exports the default header in readable white or dark grey for all six teaching backgrounds',async()=>{
 const old=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const t=structuredClone(templates);for(const variant of ['dark','light'] as const)for(const slide of t[variant].slides)for(const item of slide.items)if(item.src)item.src='data:image/jpeg;base64,'+fs.readFileSync('public'+item.src).toString('base64');
  const p=newProject();p.slides=(['dark','light'] as const).flatMap(variant=>[2,3,4].map(templateIndex=>({...blankSlide(templateIndex),theme:{variant,headerTextColor:'#ffffff'}})));
  const blob=await exportDeck(p,t,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:false},()=>{}),zip=await JSZip.loadAsync(await blob.arrayBuffer());
  for(let i=0;i<p.slides.length;i++){
   const expected=i===0?'292A32':'FFFFFF',resolved=resolveSlide(p,p.slides[i],t,i);expect(resolved.elements.find(e=>e.id==='heading')).toMatchObject({text:'Type Your Text Here',color:'#'+expected.toLowerCase()});
   const xml=await zip.file('ppt/slides/slide'+(i+1)+'.xml')!.async('string'),doc=new JSDOM(xml,{contentType:'text/xml'}).window.document;
   const shape=[...doc.getElementsByTagNameNS('*','sp')].find(n=>[...n.getElementsByTagNameNS('*','t')].map(v=>v.textContent).join('')==='Type Your Text Here')!;expect(shape).toBeTruthy();expect([...shape.getElementsByTagNameNS('*','rPr')].every(n=>n.getElementsByTagNameNS('*','srgbClr')[0]?.getAttribute('val')===expected)).toBe(true);
  }
 }finally{(globalThis as any).document=old;}
});
