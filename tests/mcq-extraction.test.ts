import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {extractMCQs} from '../src/mcq';
import {createMCQDeck} from '../src/mcqSlides';
import {newProject,type TemplateSet} from '../src/model';
import {auditSources,paginateSlide} from '../src/parser';
import {resolveSlide} from '../src/layout';
import {answerOverlay} from '../src/answers';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {exportDeck} from '../src/exporter';
import {exportProject,importProject} from '../src/storage';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
const source=`Indian Constitution notes
Description: This lesson has detailed background.
1.

भारत की राजधानी क्या है?
A) मुंबई
B) नई दिल्ली
C) जयपुर
D) चेन्नई
उत्तर: B) नई दिल्ली
व्याख्या: यह पूरी explanation केवल source में रहेगी।

2.
What is 25% of 240?
A) 40
B) 50
C) 60
D) 80
Correct answer: C
Explanation: Multiply 240 by 25 / 100.
Description: Extra lesson notes must not be on a slide.`;
describe('MCQ-only extraction',()=>{
 it('keeps standalone question numbers inline and gives options a clear gap in both arrangements',()=>{
  for(const prefix of ['12.','12)','(12)','Q. 12','Question 12:','Q No. 12','प्रश्न १२']){
   const p=newProject();p.source=`${prefix}\n\nभारत की राजधानी क्या है?\nA) मुंबई\nB) दिल्ली\nC) जयपुर\nD) चेन्नई\nउत्तर: B`;
   const {project}=createMCQDeck(p,templates);expect(project.slides).toHaveLength(1);expect(project.slides[0].text.split('\n')[0]).toContain('भारत की राजधानी क्या है?');
   for(const optionsMode of ['vertical','columns'] as const){const s={...project.slides[0],optionsMode};const r=resolveSlide(project,s,templates,0);const q=r.elements.find(e=>e.id==='question')!,option=r.elements.find(e=>e.id==='option-0')!;expect(q.lines).toHaveLength(1);expect(option.y-(q.y+q.h)).toBeGreaterThanOrEqual(36);expect(r.warnings).toEqual([]);}
  }
  const copied=extractMCQs('1\nFirst question?\nA) One\nB) Two\n2\nSecond question?\nA) Three\nB) Four');expect(copied.questions).toHaveLength(2);expect(copied.questions[0].options[1].text).toBe('Two');expect(copied.questions[1].question).toBe('2. Second question?');
 });
 it('removes the entire Correct answer / सही उत्तर marker without leaving a word in the last option',()=>{const r=extractMCQs(source);expect(r.questions[1].options[3].text).toBe('80');expect(r.questions[1].text).not.toContain('Correct');const hindi=extractMCQs('1. प्रश्न?\nA) एक\nB) दो\nसही उत्तर: B');expect(hindi.questions[0].options[1].text).toBe('दो');expect(hindi.questions[0].text).not.toContain('सही');expect(hindi.questions[0].correctOption).toBe(1);});
 it('extracts only question/options and associates each supplied answer',()=>{const r=extractMCQs(source);expect(r.questions).toHaveLength(2);expect(r.questions.map(q=>q.correctOption)).toEqual([1,2]);expect(r.questions[0].text).toBe('1. भारत की राजधानी क्या है?\nA) मुंबई\nB) नई दिल्ली\nC) जयपुर\nD) चेन्नई');expect(r.questions[1].text).not.toMatch(/Explanation|Multiply|Description|Correct answer/);});
 it('splits inline questions/options and inline answer metadata',()=>{const r=extractMCQs('Q1. What is 2+2? (a) 3 (b) 4 (c) 5 (d) 6 Answer: (b) Explanation: Addition.\nQ2: Colour of the sky? A) Red B) Blue C) Green D) Black Ans: B');expect(r.questions).toHaveLength(2);expect(r.questions.map(q=>q.correctOption)).toEqual([1,1]);expect(r.questions[0].options.map(o=>o.text)).toEqual(['3','4','5','6']);});
 it('handles copied separate numbers and option labels, removes navigation',()=>{const r=extractMCQs('1\nWhat comes next?\nA)\n\nFirst\n\nB)\nSecond\n\nC)\nThird\n\nD)\nFourth\nView Answer\nAnswer: C\nDiscuss\nSave\n2\nWhat is last?\nA) One\nB) Two\nAnswer: B');expect(r.questions).toHaveLength(2);expect(r.questions[0].text).not.toMatch(/View|Discuss|Save/);expect(r.questions.map(q=>q.correctOption)).toEqual([2,1]);});
 it('handles unnumbered English and Hindi questions',()=>{const r=extractMCQs('General lesson description\n\nWhich city is the capital?\nA. Delhi\nB. Mumbai\nAnswer: Delhi\nExplanation: Government seat.\n\nभारत की राजधानी कौन सी है?\n(क) मुंबई\n(ख) दिल्ली\n(ग) जयपुर\n(घ) चेन्नई\nसही उत्तर: (ख)');expect(r.questions).toHaveLength(2);expect(r.questions.map(q=>q.correctOption)).toEqual([0,1]);expect(r.questions[0].question).toBe('Which city is the capital?');});
 it('handles numerical options and matching supplied option text',()=>{const r=extractMCQs('1) Choose a city.\n(1) Mumbai\n(2) New Delhi\n(3) Chennai\n(4) Jaipur\nAnswer: New Delhi');expect(r.questions[0].question).toBe('1. Choose a city.');expect(r.questions[0].correctOption).toBe(1);expect(r.questions[0].options[1].label).toBe('(2)');});
 it('uses an answer key by question number rather than output index',()=>{const r=extractMCQs('Q12. First?\nA) One\nB) Two\nQ18. Second?\nA) Three\nB) Four\nAnswer Key\n18-B, 12-A');expect(r.questions.map(q=>q.correctOption)).toEqual([0,1]);});
 it('recognizes explicit check marks without leaking them into the question',()=>{const r=extractMCQs('1. Correct city?\nA) Delhi ✅\nB) Mumbai\nC) Jaipur\nD) Chennai');expect(r.questions[0].correctOption).toBe(0);expect(r.questions[0].text).not.toContain('✅');});
 it('does not solve missing answers or guess conflicting/multiple answers',()=>{const r=extractMCQs('1. Pick?\nA) One\nB) Two\nAnswer: A and B\n2. Pick?\nA) One\nB) Two\nAnswer: A\nCorrect answer: B\n3. Pick?\nA) One\nB) Two');expect(r.questions.map(q=>q.correctOption)).toEqual([undefined,undefined,undefined]);expect(r.needsReview).toBe(2);});
 it('keeps a multi-line stem and wrapped options without explanation',()=>{const r=extractMCQs('Q1. Consider the following statements:\n1. The first statement is given.\n2. The second statement is given.\nWhich of these is correct?\nA) Both statements\nare correct\nB) Only the first\nstatement is correct\nC) Only the second\nD) Neither\nSolution:\nA detailed solution follows.\nAnswer: A');expect(r.questions[0].question).toContain('1. The first statement');expect(r.questions[0].question).toContain('2. The second statement');expect(r.questions[0].options[0].text).toBe('Both statements\nare correct');expect(r.questions[0].correctOption).toBe(0);expect(r.questions[0].text).not.toContain('detailed solution');});
 it('builds a questions-only deck, keeps original source, and reveals each answer separately',()=>{const p=newProject();p.source=source;p.answerMode='separate';const {project}=createMCQDeck(p,templates);expect(project.slides).toHaveLength(2);expect(project.slides.every(s=>s.layout==='mcq')).toBe(true);expect(project.source).toBe(source);expect(project.slides.every(s=>!s.notes)).toBe(true);expect(auditSources(project).missing).toEqual([]);expect(auditSources(project).questions).toBe(2);for(const [i,s] of project.slides.entries()){const r=resolveSlide(project,s,templates,i);expect(r.elements.map(e=>e.text||'').join('\n')).not.toMatch(/Explanation|व्याख्या|Description|Multiply/);expect(r.elements.some(e=>e.id==='answer-reveal')).toBe(false);expect(answerOverlay(s,r)?.text).toBe(i===0?'B) नई दिल्ली':'C) 60');expect(r.warnings).toEqual([]);}});
 it('keeps one MCQ per slide, never splits a correct-answer index onto a different question',()=>{const p=newProject();p.source='1. '+('Long question detail. '.repeat(200))+'\nA) One\nB) Two\nAnswer: B';const {project}=createMCQDeck(p,templates);expect(project.slides).toHaveLength(1);expect(project.slides[0].text).toContain('Long question detail. '.repeat(2));expect(paginateSlide(project,project.slides[0])).toHaveLength(1);expect(resolveSlide(project,project.slides[0],templates,0).warnings.length).toBeGreaterThan(0);});
 it('rejects notes without MCQs without replacing the current deck',()=>{const p=newProject();p.source='Description: A long lesson with no labelled options.';expect(()=>createMCQDeck(p,templates)).toThrow('No complete MCQs');expect(p.slides).toHaveLength(7);});
 it('extracts 50 MCQs with separate explanations and correct answers',()=>{const input=Array.from({length:50},(_,i)=>`${i+1}. Question ${i+1}?\nA) First\nB) Second\nC) Third\nD) Fourth\nAns. (C)\nExplanation: Detailed solution ${i+1}.`).join('\n\n');const p=newProject();p.source=input;const {project,analysis}=createMCQDeck(p,templates);expect(project.slides).toHaveLength(50);expect(analysis.matchedAnswers).toBe(50);expect(project.slides.every(s=>s.text.includes('D) Fourth')&&!s.text.includes('Detailed'))).toBe(true);});
});

describe('extracted MCQ exports',()=>{
 it('keeps extracted mode and per-question answers through a portable project backup',async()=>{const p=newProject();p.source=source;const {project}=createMCQDeck(p,templates);const backup=await exportProject(project);const restored=await importProject(new File([await backup.arrayBuffer()],'mcqs.zip'));expect(restored.contentMode).toBe('mcq-only');expect(restored.slides.map(s=>s.correctOption)).toEqual([1,2]);expect(restored.slides.every(s=>s.mcqOnly&&s.answerOrigin==='source')).toBe(true);expect(restored.source).toBe(source);});
 it('exports two original-template slides with independent click effects and no explanation text',async()=>{
  const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
  try{
   const t=structuredClone(templates);for(const variant of ['dark','light'] as const)for(const slide of t[variant].slides)for(const item of slide.items)if(item.src)item.src='data:image/jpeg;base64,'+fs.readFileSync('public'+item.src).toString('base64');
   const p=newProject();p.source=source.replace(/^उत्तर:.*\r?\n/m,'').replace(/^Correct answer:.*\r?\n/m,'')+'\n\nAnswer Key\n2-C, 1-B';p.theme.headerText='MCQ Practice | अभ्यास';const {project}=createMCQDeck(p,t);
   const blob=await exportDeck(project,t,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:true},()=>{}),bytes=await blob.arrayBuffer(),zip=await JSZip.loadAsync(bytes);const dom=new JSDOM().window;
   for(let i=1;i<=2;i++){const xml=await zip.file(`ppt/slides/slide${i}.xml`)!.async('string'),doc=new dom.DOMParser().parseFromString(xml,'application/xml');expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);const allText=[...doc.getElementsByTagNameNS('*','t')].map(n=>n.textContent).join('');expect(allText).not.toMatch(/व्याख्या|explanation|Multiply|Description|background/);expect(doc.getElementsByTagNameNS('*','timing')).toHaveLength(1);expect(doc.getElementsByTagNameNS('*','spTgt')).toHaveLength(2);expect([...doc.getElementsByTagNameNS('*','cTn')].filter(n=>n.getAttribute('nodeType')==='clickEffect')).toHaveLength(1);expect(allText).toContain(i===1?'नई दिल्ली':'60');}
   expect(zip.file('ppt/slides/slide3.xml')).toBeNull();fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/extracted-mcqs.pptx',Buffer.from(bytes));
   const plain=await exportDeck(project,t,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:false},()=>{}),plainZip=await JSZip.loadAsync(await plain.arrayBuffer());for(let i=1;i<=2;i++)expect(await plainZip.file(`ppt/slides/slide${i}.xml`)!.async('string')).not.toContain('ClassSlide Answer Reveal');
  }finally{(globalThis as any).document=prior;}
 });
});
