import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {blankSlide,newProject,type TemplateSet} from '../src/model';
import {orderedQuestion,orderedOption} from '../src/questionOrder';
import {resolveSlide} from '../src/layout';
import {answerOptions,answerOverlay} from '../src/answers';
import {nativeText} from '../src/nativeText';
import {editingTextRuns} from '../src/textHighlight';
import {readLanguageEntry,languageEntries,applyLanguageEntries} from '../src/languages';
import {makeStylePreset,applyStylePreset,validateStylePreset} from '../src/stylePresets';
import {exportProject,importProject,validateProject} from '../src/storage';
import {exportDeck} from '../src/exporter';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
const hi='भारत की राजधानी क्या है?',en='What is the capital of India?';
function sample(){const p=newProject();p.theme.mode='custom';p.source='Original pasted content';p.style={...p.style,hindiFont:'Mangal',englishFont:'Aptos',questionHindiColor:'#00e6cc',questionEnglishColor:'#ffb347'};p.slides=[{...blankSlide(),layout:'mcq',text:'Q.12 '+hi+'\n'+en+'\nA. नई दिल्ली / New Delhi\nB. मुंबई / Mumbai',correctOption:0,answerReveal:true,optionsMode:'vertical'}];p.slides[0].languages=readLanguageEntry(p.slides[0]).data;return p;}
it.each(['Q.12','प्रश्न १२','(45)','Question 123:'])('keeps %s inline and switches both ways without duplication',prefix=>{
 const source=prefix+'\n'+hi+' / '+en;
 const english=prefix+' '+en+'\n'+hi,hindi=prefix+' '+hi+'\n'+en;
 expect(orderedQuestion(source,'en-first')).toBe(english);expect(orderedQuestion(source,'hi-first')).toBe(hindi);
 expect(orderedQuestion(english,'en-first')).toBe(english);expect(orderedQuestion(english,'hi-first')).toBe(hindi);
 expect(orderedQuestion(hindi,'en-first')).toBe(english);
});
it('retains multiline language blocks, fractions, units and Hindi technical abbreviations',()=>{
 const hindi='DNA क्या है?\nदूरी किमी/घंटा में और अंश 1 / 2 लें।',english='What is DNA?\nUse km/h and the fraction 1 / 2.';
 expect(orderedQuestion('Q.7 '+hindi+'\n'+english,'en-first')).toBe('Q.7 '+english+'\n'+hindi);
 expect(orderedQuestion('Q.7 '+english+'\n'+hindi,'hi-first')).toBe('Q.7 '+hindi+'\n'+english);
 expect(orderedQuestion('Q.2 अंश 1 / 2 कितना है? / What is 1 / 2?','en-first')).toBe('Q.2 What is 1 / 2?\nअंश 1 / 2 कितना है?');
});
it('leaves single-language, ambiguous and As pasted questions intact',()=>{
 for(const text of ['Q.1 '+hi,'Q.2 '+en,'Q.3 Which is 1/2?','Q.4 60 / 2','Q.5 हिंदी / English / फिर हिंदी'])for(const order of ['hi-first','en-first'] as const)expect(orderedQuestion(text,order)).toBe(text);
 const text='Q.12 '+en+' / '+hi;expect(orderedQuestion(text)).toBe(text);expect(orderedQuestion(text,'original')).toBe(text);
});
it.each(['A.','B)', '(C)', '[D]', 'क)', '1)'])('reorders bilingual option %s both ways without changing its label',prefix=>{
 const source=prefix+' नई दिल्ली / New Delhi',english=prefix+' New Delhi / नई दिल्ली';
 expect(orderedOption(source,'en-first')).toBe(english);expect(orderedOption(english,'en-first')).toBe(english);
 expect(orderedOption(english,'hi-first')).toBe(source);expect(orderedOption(source,'hi-first')).toBe(source);
 expect(orderedOption(prefix+' नई दिल्ली\nNew Delhi','en-first')).toBe(english);
 expect(orderedOption(source)).toBe(source);expect(orderedOption(english,'original')).toBe(english);
});
it('preserves fractions, units, technical abbreviations and ambiguous or single-language options',()=>{
 const hindi='DNA की गति 1 / 2 किमी/घंटा',english='DNA speed 1 / 2 km/h';
 expect(orderedOption('A. '+hindi+' / '+english,'en-first')).toBe('A. '+english+' / '+hindi);
 expect(orderedOption('A. '+english+' / '+hindi,'hi-first')).toBe('A. '+hindi+' / '+english);
 for(const text of ['A. नई दिल्ली','B. New Delhi','C. 1 / 2','D. हिंदी / English / फिर हिंदी','A. km/h'])for(const order of ['hi-first','en-first'] as const)expect(orderedOption(text,order)).toBe(text);
});
it('reorders displayed questions and options while retaining source, answer, colours, fonts and language cache',()=>{
 const p=sample(),s=p.slides[0],before=structuredClone(p),options=answerOptions(s);s.style.questionLanguageOrder='en-first';
 const r=resolveSlide(p,s,templates,0),q=r.elements.find(e=>e.id==='question')!;
 expect(q.text).toBe('Q.12 '+en+'\n'+hi);expect(q.lines![0]).toMatch(/^Q.12 What/);
 expect(editingTextRuns(q).map(run=>run.text).join('')).toBe(q.text);
 const runs=nativeText(q);expect(runs.find(run=>run.text.includes('What'))?.options).toMatchObject({fontFace:'Aptos',color:'ffb347'});expect(runs.find(run=>run.text.includes('भारत'))?.options).toMatchObject({fontFace:'Mangal',color:'00e6cc'});
 expect(answerOptions(s)).toEqual(options);expect(s.correctOption).toBe(0);expect(s.text).toBe(before.slides[0].text);expect(s.languages).toEqual(before.slides[0].languages);expect(p.source).toBe(before.source);
 const firstOption=r.elements.find(e=>e.id==='option-0')!;expect(firstOption.text).toBe('A. New Delhi / नई दिल्ली');expect(firstOption.y-q.y-q.h).toBeCloseTo(36);expect(r.warnings).toEqual([]);
 expect(answerOverlay(s,r)?.text).toBe(firstOption.text);
 const optionRuns=nativeText(firstOption);expect(optionRuns.find(run=>run.text.includes('New Delhi'))?.options.fontFace).toBe('Aptos');expect(optionRuns.find(run=>run.text.includes('नई दिल्ली'))?.options.fontFace).toBe('Mangal');
});
it('honours edited questions, retains single-language conversion and reapplies the order when both languages return',()=>{
 let p=sample();p.style.questionLanguageOrder='en-first';p.slides[0].edits.question='Q.12 नया प्रश्न? / New question?';p.slides[0].edits['option-0']='A. नया उत्तर / New answer';
 let option=resolveSlide(p,p.slides[0],templates,0).elements.find(e=>e.id==='option-0')!;expect(option.text).toBe('A. New answer / नया उत्तर');p.slides[0].edits['option-0']=option.text!;
 let q=resolveSlide(p,p.slides[0],templates,0).elements.find(e=>e.id==='question')!;expect(q.text).toBe('Q.12 New question?\nनया प्रश्न?');
 p.slides[0].edits.question=q.text!;p.slides[0].style.questionLanguageOrder='hi-first';
 q=resolveSlide(p,p.slides[0],templates,0).elements.find(e=>e.id==='question')!;expect(q.text).toBe('Q.12 नया प्रश्न?\nNew question?');
 option=resolveSlide(p,p.slides[0],templates,0).elements.find(e=>e.id==='option-0')!;expect(option.text).toBe('A. नया उत्तर / New answer');
 p=sample();p.style.questionLanguageOrder='en-first';p=applyLanguageEntries(p,languageEntries(p),'hi',templates);
 expect(resolveSlide(p,p.slides[0],templates,0).elements.find(e=>e.id==='question')!.text).toBe('Q.12 '+hi);
 expect(resolveSlide(p,p.slides[0],templates,0).elements.find(e=>e.id==='option-0')!.text).toBe('A. नई दिल्ली');
 p=applyLanguageEntries(p,languageEntries(p),'both',templates);expect(resolveSlide(p,p.slides[0],templates,0).elements.find(e=>e.id==='question')!.text).toBe('Q.12 '+en+'\n'+hi);
 expect(resolveSlide(p,p.slides[0],templates,0).elements.find(e=>e.id==='option-0')!.text).toBe('A. New Delhi / नई दिल्ली');
});
it('retains order in presets/backups, validates it and leaves single-language theory unchanged',async()=>{
 const p=sample();p.style.questionLanguageOrder='en-first';const preset=makeStylePreset(p,p.slides[0],'English first');validateStylePreset(preset);
 expect(applyStylePreset(sample(),JSON.parse(JSON.stringify(preset))).style.questionLanguageOrder).toBe('en-first');
 const restored=await importProject(new File([await(await exportProject(p)).arrayBuffer()],'order.zip'));expect(restored.style.questionLanguageOrder).toBe('en-first');
 expect(()=>validateProject({...p,style:{...p.style,questionLanguageOrder:'invalid'}})).toThrow('Invalid question language order');
 const theory={...blankSlide(),layout:'theory' as const,theory:{title:'विषय'},text:hi};const before=resolveSlide(p,theory,templates,0);p.style.questionLanguageOrder='hi-first';expect(resolveSlide(p,theory,templates,0)).toEqual(before);
});
it.each(['vertical','columns','adaptive'] as const)('fits reordered and edited options before choosing %s geometry',optionsMode=>{
 const p=sample(),s=p.slides[0];s.optionsMode=optionsMode;s.text+='\nC. चेन्नई / Chennai\nD. पुणे / Pune';s.edits['option-0']='A. दिल्ली\nDelhi';
 for(const order of ['en-first','hi-first'] as const){
  s.style.questionLanguageOrder=order;
  const r=resolveSlide(p,s,templates,0),options=r.elements.filter(e=>e.id.startsWith('option-'));
  expect(options[0].text).toBe(order==='en-first'?'A. Delhi / दिल्ली':'A. दिल्ली / Delhi');expect(options[0].lines).toHaveLength(1);
  expect(options[1].x>options[0].x).toBe(optionsMode!=='vertical');
  const next=options[optionsMode==='vertical'?1:2];expect(next.y-options[0].y-options[0].h).toBeCloseTo(8);expect(r.warnings).toEqual([]);
 }
 s.optionsMode='adaptive';s.style.questionLanguageOrder='en-first';s.edits['option-0']='A. भारत की राजधानी नई दिल्ली है और मुंबई महाराष्ट्र में है / The capital of India is New Delhi and Mumbai is in Maharashtra';
 const r=resolveSlide(p,s,templates,0),options=r.elements.filter(e=>e.id.startsWith('option-'));
 expect(options[0].text).toMatch(/^A\. The capital/);expect(options[1].x).toBe(options[0].x);expect(options[1].y).toBeGreaterThanOrEqual(options[0].y+options[0].h);expect(r.warnings).toEqual([]);
});
it('exports both language orders as editable PPTX with matching preview geometry and answer text',async()=>{
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const p=sample(),seed=p.slides[0];p.slides=(['hi-first','en-first'] as const).map(order=>({...seed,id:order,style:{questionLanguageOrder:order}}));
  const bytes=await(await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:true},()=>{})).arrayBuffer(),zip=await JSZip.loadAsync(bytes);
  for(const [i,s] of p.slides.entries()){
   const doc=new JSDOM(await zip.file('ppt/slides/slide'+(i+1)+'.xml')!.async('string'),{contentType:'text/xml'}).window.document;
   const shapes=[...doc.getElementsByTagNameNS('*','sp')],text=(shape:Element)=>[...shape.getElementsByTagNameNS('*','t')].map(n=>n.textContent).join('');
   const question=shapes.find(shape=>text(shape).includes('capital'))!,value=text(question),r=resolveSlide(p,s,templates,i),q=r.elements.find(e=>e.id==='question')!;
   expect(value.match(/Q.12/g)).toHaveLength(1);expect(value.indexOf('What')<value.indexOf('भारत')).toBe(i===1);
   expect(Number(question.getElementsByTagNameNS('*','ext')[0].getAttribute('cy'))/6350).toBeCloseTo(q.h,3);
   const optionText=i===1?'A. New Delhi / नई दिल्ली':'A. नई दिल्ली / New Delhi',otherText=i===1?'B. Mumbai / मुंबई':'B. मुंबई / Mumbai';
   expect(shapes.some(shape=>text(shape)===otherText)).toBe(true);
   const option=shapes.find(shape=>shape.getElementsByTagNameNS('*','cNvPr')[0]?.getAttribute('name')==='ClassSlide Text option-0')!;
   const answer=shapes.find(shape=>shape.getElementsByTagNameNS('*','cNvPr')[0]?.getAttribute('name')==='ClassSlide Answer Reveal')!;
   expect(text(option)).toBe(optionText);expect(text(answer)).toBe(optionText);
   expect(Number(option.getElementsByTagNameNS('*','off')[0].getAttribute('y'))/6350).toBeCloseTo(r.elements.find(e=>e.id==='option-0')!.y,3);
  }
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/question-language-order.pptx',Buffer.from(bytes));
 }finally{(globalThis as any).document=prior;}
});
