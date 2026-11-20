import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {blankSlide,newProject,type TemplateSet} from '../src/model';
import {resolveSlide} from '../src/layout';
import {exportDeck} from '../src/exporter';

const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
const content='Q.1 निम्नलिखित कथनों को ध्यान से पढ़िए।\nभारत का संविधान नागरिकों को कौन-सा अधिकार देता है?\nWhich right does the Constitution of India provide?\nA. स्वतंत्रता / Liberty\nB. समानता / Equality\nC. न्याय / Justice\nD. शिक्षा / Education';

it.each(['vertical','columns','adaptive'] as const)('uses the chosen question gap in %s layouts without changing text or option spacing',optionsMode=>{
 const p=newProject(),s={...blankSlide(),layout:'mcq' as const,optionsMode,text:content};
 for(const gap of [8,36,96,200]){
  s.style={questionGap:gap};const r=resolveSlide(p,s,templates,0),q=r.elements.find(e=>e.id==='question')!,options=r.elements.filter(e=>e.id.startsWith('option-'));
  expect(options[0].y-q.y-q.h).toBeCloseTo(gap);expect(options[0].y).toBeGreaterThan(q.y+q.h);
  expect(q.size).toBe(p.style.size);expect(options.every(e=>e.size===p.style.optionSize)).toBe(true);
  const next=options.find(e=>e.y>options[0].y)!;expect(next.y-options[0].y-options[0].h).toBeCloseTo(8);
 }
});

it.each(['vertical','columns'] as const)('keeps a compact question gap while preserving %s option spacing and font sizes',optionsMode=>{
 const p=newProject(),s={...blankSlide(),layout:'mcq' as const,optionsMode,text:content};
 for(const paragraphGap of [0,16,32]){
  s.style={paragraphGap};const r=resolveSlide(p,s,templates,0),q=r.elements.find(e=>e.id==='question')!,options=r.elements.filter(e=>e.id.startsWith('option-'));
  expect(q.lines!.length).toBeGreaterThan(1);expect(q.size).toBe(p.style.size);expect(q.lineHeight).toBe(p.style.lineHeight);
  expect(options[0].y-q.y-q.h).toBeCloseTo(Math.max(36,paragraphGap+20));
  const next=options[optionsMode==='columns'?2:1];expect(next.y-options[0].y-options[0].h).toBeCloseTo(8);
  expect(options.every(e=>e.size===p.style.optionSize)).toBe(true);expect(r.warnings).toEqual([]);
 }
});

it('exports multiline bilingual questions with exact preview line heights and question/option gaps in both themes',async()=>{
 const prior=(globalThis as any).document;
 (globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const p=newProject();p.theme.mode='custom';p.style.size=28;p.style.labelColor='#ffff00';p.style.highlight='संविधान';p.style.questionGap=52;
  p.slides=[];
  for(const font of ['Mangal','Kokila','Noto Sans Devanagari'])for(const variant of ['dark','light'] as const)for(const lineHeight of [1.35,1.5])p.slides.push({...blankSlide(),layout:'mcq',text:content,optionsMode:lineHeight===1.35?'vertical':'columns',style:{font,lineHeight,...(lineHeight===1.5?{questionGap:84}:{})},theme:{variant,background:variant==='dark'?'#191b1c':'#ffffff',textColor:variant==='dark'?'#ffffff':'#171925'}});
  const blob=await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:false},()=>{}),bytes=await blob.arrayBuffer(),zip=await JSZip.loadAsync(bytes),baseline=await JSZip.loadAsync(bytes),records=[];
  for(let index=0;index<p.slides.length;index++){
   const resolved=resolveSlide(p,p.slides[index],templates,index),q=resolved.elements.find(e=>e.id==='question')!,option=resolved.elements.find(e=>e.id==='option-0')!;
   const path=`ppt/slides/slide${index+1}.xml`,xml=await zip.file(path)!.async('string'),doc=new JSDOM(xml,{contentType:'text/xml'}).window.document;
   const shapes=[...doc.getElementsByTagNameNS('*','sp')],question=shapes.find(shape=>shape.textContent?.includes('Constitution of India'))!,firstOption=shapes.find(shape=>shape.textContent?.includes('Liberty'))!;
   const lineSpacings=[...question.getElementsByTagNameNS('*','lnSpc')];expect(lineSpacings.length).toBeGreaterThanOrEqual(q.lines!.length);
   const linePoints=Math.round(q.size!*q.lineHeight!*100);
   for(const spacing of lineSpacings){expect(spacing.getElementsByTagNameNS('*','spcPct')).toHaveLength(0);expect(spacing.getElementsByTagNameNS('*','spcPts')[0].getAttribute('val')).toBe(String(linePoints));}
   expect([...question.getElementsByTagNameNS('*','rPr')].every(run=>run.getAttribute('sz')===String(q.size!*100))).toBe(true);
   const qOff=question.getElementsByTagNameNS('*','off')[0],qExt=question.getElementsByTagNameNS('*','ext')[0],oOff=firstOption.getElementsByTagNameNS('*','off')[0];
   expect(Number(oOff.getAttribute('y'))-Number(qOff.getAttribute('y'))-Number(qExt.getAttribute('cy'))).toBeCloseTo((option.y-q.y-q.h)*6350,0);
   expect(option.y-q.y-q.h).toBeCloseTo(p.slides[index].style.questionGap??52);
   records.push({slide:index+1,font:q.font,linePoints:linePoints/100,lines:q.lines!.length,questionTop:q.y/2,questionHeight:q.h/2,optionTop:option.y/2,gap:(option.y-q.y-q.h)/2});
   // Comparison fixture retains the former percentage-based question spacing.
   for(const spacing of lineSpacings){const points=spacing.getElementsByTagNameNS('*','spcPts')[0],percent=doc.createElementNS(points.namespaceURI,'a:spcPct');percent.setAttribute('val',String(Math.round(q.lineHeight!*100000)));points.replaceWith(percent);}
   const priorXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+doc.documentElement.outerHTML;expect(priorXml).toContain('a:spcPct val="'+Math.round(q.lineHeight!*100000)+'"');baseline.file(path,priorXml);
  }
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/question-spacing.pptx',Buffer.from(bytes));fs.writeFileSync('test-output/question-spacing-expected.json',JSON.stringify(records,null,2));
  fs.writeFileSync('test-output/question-spacing-before.pptx',await baseline.generateAsync({type:'nodebuffer'}));
 }finally{(globalThis as any).document=prior;}
});
