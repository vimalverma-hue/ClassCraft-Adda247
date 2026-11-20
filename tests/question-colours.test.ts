import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {blankSlide,newProject,type TemplateSet} from '../src/model';
import {resolveSlide} from '../src/layout';
import {highlightedRuns,editingTextRuns} from '../src/textHighlight';
import {nativeText} from '../src/nativeText';
import {questionColourRuns,validateQuestionColours} from '../src/questionColours';
import {labelColourRuns} from '../src/labelColour';
import {readableColour} from '../src/colourContrast';
import {answerOverlay} from '../src/answers';
import {makeStylePreset,applyStylePreset,validateStylePreset} from '../src/stylePresets';
import {exportProject,importProject,validateProject} from '../src/storage';
import {exportDeck} from '../src/exporter';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
const colours={questionHindiColor:'#00e6cc',questionEnglishColor:'#ffb347'};
function sample(){const p=newProject();p.theme.mode='custom';p.style={...p.style,hindiFont:'Mangal',englishFont:'Aptos'};p.slides=[{...blankSlide(),layout:'mcq',text:'Q.1 भारत की राजधानी / Capital of India?\nA. नई दिल्ली / New Delhi\nB. मुंबई / Mumbai',optionsMode:'vertical',correctOption:0,answerReveal:true}];return p;}
it.each(['Q.1','प्रश्न १२','(45)','Question 123:'])('preserves %s and applies language colours only to the question wording',prefix=>{
 const text=prefix+' क्षि क्‍ष भूमि / Capital 2026\nभारत / India';
 const runs=questionColourRuns(labelColourRuns(text,'question','#ffff00'),colours);
 expect(runs.map(r=>r.text).join('')).toBe(text);
 expect(runs.filter(r=>r.color==='#ffff00').map(r=>r.text).join('')).toBe(prefix);
 expect(runs.filter(r=>r.text.includes('भूमि')).every(r=>r.color===colours.questionHindiColor)).toBe(true);
 expect(runs.filter(r=>r.text.includes('Capital')).every(r=>r.color===colours.questionEnglishColor)).toBe(true);
 expect(runs.some(r=>r.text.includes('क्‍ष'))).toBe(true);
});
it('keeps all option text, answer reveal, headers and theory unchanged',()=>{
 const p=sample();p.theme.headerText='पाठ / Lesson';p.slides.push({...blankSlide(),layout:'theory',theory:{title:'भारत / India'},text:'नागरिक / Citizens'});
 const before=p.slides.map((s,i)=>resolveSlide(p,s,templates,i));p.style={...p.style,...colours};
 const after=p.slides.map((s,i)=>resolveSlide(p,s,templates,i));
 expect(after[0].elements.filter(e=>e.id!=='question')).toEqual(before[0].elements.filter(e=>e.id!=='question'));
 expect(after[1]).toEqual(before[1]);expect(answerOverlay(p.slides[0],after[0])).toEqual(answerOverlay(p.slides[0],before[0]));
 const q=after[0].elements.find(e=>e.id==='question')!,runs=nativeText(q);
 expect(runs.find(r=>r.text.includes('भारत'))?.options).toMatchObject({fontFace:'Mangal',color:'00e6cc'});
 expect(runs.find(r=>r.text.includes('Capital'))?.options).toMatchObject({fontFace:'Aptos',color:'ffb347'});
});
it('supports single-language custom colour, automatic reset, wrapped text and direct editing',()=>{
 const p=sample();p.style={...p.style,...colours};p.slides[0].reserve='right';p.slides[0].reserveWidth=1100;
 const q=resolveSlide(p,p.slides[0],templates,0).elements.find(e=>e.id==='question')!;
 expect(q.lines!.length).toBeGreaterThan(1);
 expect(editingTextRuns(q).map(r=>r.text).join('')).toBe(q.text);
 expect(editingTextRuns(q).find(r=>r.text.includes('भारत'))?.color).toBe(colours.questionHindiColor);
 p.style.questionHindiColor='';const reset=resolveSlide(p,p.slides[0],templates,0).elements.find(e=>e.id==='question')!;
 const runs=highlightedRuns(reset);expect(runs.find(r=>r.text.includes('भारत'))?.color).toBeUndefined();expect(runs.find(r=>r.text.includes('Capital'))?.color).toBe(colours.questionEnglishColor);
 const original=labelColourRuns('Q.1 भारत / India','question','#ffff00');expect(questionColourRuns(original,{})).toBe(original);
});
it('keeps keyword highlighting readable while retaining the other question colours',()=>{
 const p=sample();p.style={...p.style,...colours,highlight:'Capital',highlightColor:'#46ef5a'};
 const q=resolveSlide(p,p.slides[0],templates,0).elements.find(e=>e.id==='question')!,runs=highlightedRuns(q);
 expect(runs.find(r=>r.text==='Capital')).toMatchObject({font:'Aptos',color:'#171925',highlight:'#46ef5a'});
 expect(runs.find(r=>r.text.includes('भारत'))?.color).toBe(colours.questionHindiColor);
 expect(runs.find(r=>r.text.includes('India'))?.color).toBe(colours.questionEnglishColor);
});
it('round-trips question colours in presets and backups and rejects invalid colour values',async()=>{
 const p=sample();p.slides[0].style={...colours};const preset=makeStylePreset(p,p.slides[0],'Question colours');validateStylePreset(preset);
 expect(applyStylePreset(sample(),JSON.parse(JSON.stringify(preset))).style).toMatchObject(colours);
 const backup=await exportProject(p),restored=await importProject(new File([await backup.arrayBuffer()],'colours.zip'));expect(restored.slides[0].style).toMatchObject(colours);
 expect(()=>validateQuestionColours({questionHindiColor:'red'})).toThrow();expect(()=>validateProject({...p,style:{...p.style,questionEnglishColor:123 as any}})).toThrow();
});
it('exports identical question-language colours and fonts in dark/light PPTX without changing option colours',async()=>{
 const old=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const p=sample();p.style={...p.style,...colours};const seed=p.slides[0];
  p.slides=['dark','light'].map((variant,i)=>({...seed,id:'colour-'+i,theme:{mode:'custom' as const,variant:variant as 'dark'|'light',background:variant==='dark'?'#191b1c':'#ffffff',textColor:variant==='dark'?'#ffffff':'#171925'}}));
  const bytes=await(await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:true},()=>{})).arrayBuffer(),zip=await JSZip.loadAsync(bytes);
  for(const [i,slide] of p.slides.entries()){
   const doc=new JSDOM(await zip.file('ppt/slides/slide'+(i+1)+'.xml')!.async('string'),{contentType:'text/xml'}).window.document;
   const runs=[...doc.getElementsByTagNameNS('*','r')];
   const find=(word:string)=>runs.find(r=>r.getElementsByTagNameNS('*','t')[0]?.textContent?.includes(word))!;
   const colour=(word:string)=>find(word).getElementsByTagNameNS('*','srgbClr')[0].getAttribute('val')?.toLowerCase();
   expect(colour('भारत')).toBe(readableColour(colours.questionHindiColor,slide.theme!.background!).slice(1));
   expect(colour('Capital')).toBe(readableColour(colours.questionEnglishColor,slide.theme!.background!).slice(1));
   expect(colour('नई दिल्ली')).toBe(slide.theme!.textColor!.slice(1));expect(colour('New Delhi')).toBe(slide.theme!.textColor!.slice(1));
   expect(find('भारत').getElementsByTagNameNS('*','cs')[0].getAttribute('typeface')).toBe('Mangal');expect(find('Capital').getElementsByTagNameNS('*','latin')[0].getAttribute('typeface')).toBe('Aptos');
  }
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/question-language-colours.pptx',Buffer.from(bytes));
 }finally{(globalThis as any).document=old;}
});
