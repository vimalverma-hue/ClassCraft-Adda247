import {it,expect} from 'vitest';
import fs from 'node:fs';
import {newProject,type TemplateSet} from '../src/model';
import {createMCQDeck} from '../src/mcqSlides';
import {applyLabelColour,labelColourRuns} from '../src/labelColour';
import {makeStylePreset,applyStylePreset} from '../src/stylePresets';
import {resolveSlide} from '../src/layout';
import {answerOverlay} from '../src/answers';
import {nativeText} from '../src/nativeText';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
it('colours question-number variants and option labels without colouring their wording',()=>{
 for(const prefix of ['Q.1','Q2.','Question 123:','Q No. 8','प्रश्न १२','(45)','67.','89)']){
  const runs=labelColourRuns(prefix+' भारत की राजधानी क्या है?','question','#ffcc00');expect(runs.filter(r=>r.color).map(r=>r.text).join('')).toBe(prefix);expect(runs.map(r=>r.text).join('')).toBe(prefix+' भारत की राजधानी क्या है?');expect(runs.at(-1)?.color).toBeUndefined();
 }
 for(const prefix of ['A)','B.','(C)','D:','(क)','(2)']){const runs=labelColourRuns(prefix+' New Delhi','option','#ffcc00');expect(runs[0]).toMatchObject({text:prefix,color:'#ffcc00'});expect(runs[1].color).toBeUndefined();}
});
it('applies one colour to all slides and retains it in saved styles and answer reveal',()=>{
 const p=newProject();p.source='Q.1 Capital?\nA) Mumbai\nB) Delhi\nAnswer: B\nQ.2 Next?\nA) One\nB) Two';const raw=createMCQDeck(p,templates).project;raw.slides[1].style.labelColor='#0000ff';const next=applyLabelColour(raw,'#e21b2e');expect(next.slides.every(s=>s.style.labelColor==='#e21b2e')).toBe(true);expect(next.style.labelColor).toBe('#e21b2e');
 const r=resolveSlide(next,next.slides[0],templates,0);for(const e of r.elements.filter(e=>e.id==='question'||e.id.startsWith('option-'))){expect(e.runs?.[0].color).toBe('#e84857');expect(e.runs?.map(run=>run.text).join('')).toBe(e.lines?.join('\n'));expect(e.color).toBe('#ffffff');}
 const overlay=answerOverlay(next.slides[0],r)!;expect(overlay.runs?.[0].color).toBe('#ab3540');expect(overlay.color).toBe('#12291c');
 const preset=makeStylePreset(next,next.slides[0],'Label colour');expect(applyStylePreset(newProject(),preset).style.labelColor).toBe('#e21b2e');expect(applyLabelColour(next,'').slides.every(s=>s.style.labelColor==='')).toBe(true);
});
it('keeps native PowerPoint run colour, keyword highlighting, and mixed Hindi/English text together',()=>{
 const runs=labelColourRuns('Q.1 दिल्ली / Delhi','question','#e21b2e');const native=nativeText({id:'question',kind:'text',x:0,y:0,w:1000,h:100,text:'Q.1 दिल्ली / Delhi',font:'Noto Sans Devanagari',runs,highlight:'Delhi',highlightColor:'#ffff00'});expect(native.map(r=>r.text).join('')).toBe('Q.1 दिल्ली / Delhi');expect(native.find(r=>r.text==='Q.1')?.options?.color).toBe('e21b2e');expect(native.find(r=>r.text==='Delhi')?.options?.highlight).toBe('ffff00');expect(native.filter(r=>r.text.includes('दिल्ली')).every(r=>r.options?.color===undefined)).toBe(true);
});
