import {beforeAll,afterAll,it,expect} from 'vitest';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import JSZip from 'jszip';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {languageFontRuns} from '../src/languageFonts';
import {blankSlide,newProject,type TemplateSet} from '../src/model';
import {measure,wrap,contentGeometry} from '../src/parser';
import {createTheorySlides} from '../src/theory';
import {resolveSlide} from '../src/layout';
import {nativeText} from '../src/nativeText';
import {highlightedRuns} from '../src/textHighlight';
import {answerOverlay} from '../src/answers';
import {fitTextBox,newTextBox} from '../src/textBoxes';
import {makeStylePreset,applyStylePreset,validateStylePreset} from '../src/stylePresets';
import {exportProject,importProject,validateProject} from '../src/storage';
import {exportDeck} from '../src/exporter';
import {SlideCanvas} from '../src/SlideCanvas';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
const fonts={hindiFont:'Mangal',englishFont:'Aptos'};
const oldDocument=(globalThis as any).document;
beforeAll(()=>{
 GlobalFonts.registerFromPath('public/fonts/mangalb.ttf','Mangal');GlobalFonts.registerFromPath('public/fonts/aptos-bold.ttf','Aptos');
 (globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>createCanvas(1,1)};
});
afterAll(()=>{(globalThis as any).document=oldDocument;});
function sample(){const p=newProject();p.theme.mode='custom';p.style={...p.style,...fonts};p.slides=[{...blankSlide(),layout:'mcq',optionsMode:'adaptive',text:'Q.1 राजधानी / Capital?\nA. दिल्ली / Delhi\nB. मुंबई / Mumbai\nC. जयपुर / Jaipur\nD. चेन्नई / Chennai',correctOption:0,answerReveal:true}];return p;}
it('keeps Hindi clusters intact and assigns Latin labels/numbers separately without changing text',()=>{
 const text='Q.1 क्षि क्‍ष भूमि / Capital 2026\nEnglish हिंदी।';
 const runs=languageFontRuns(text,'Noto Sans Devanagari',false,fonts);
 expect(runs.map(r=>r.text).join('')).toBe(text);
 for(const run of runs){if(/[\u0900-\u097f]/.test(run.text))expect(run.font).toBe('Mangal');if(/[A-Za-z0-9]/.test(run.text))expect(run.font).toBe('Aptos');expect(run.bold).toBe(true);}
 expect(runs.some(r=>r.text.includes('क्‍ष'))).toBe(true);
 expect(languageFontRuns(text,'Kokila',false,{})).toEqual([{text,font:'Kokila',bold:false}]);
 const regular=languageFontRuns('हिंदी English','Noto Sans',false,{hindiFont:'Mangal',englishFont:'Noto Sans'});
 expect(regular.find(r=>r.font==='Mangal')?.bold).toBe(true);expect(regular.find(r=>r.font==='Noto Sans')?.bold).toBe(false);
});
it('uses the selected font metrics for wrapping, automatic box width and answer highlights',()=>{
 const p=sample(),text='दिल्ली / Delhi';
 const expected=languageFontRuns(text,p.style.font,false,fonts).reduce((sum,r)=>sum+measure(r.text,26,r.font,r.bold),0);
 expect(measure(text,26,p.style.font,false,fonts)).toBeCloseTo(expected);
 for(const line of wrap((text+' ').repeat(10),420,26,p.style.font,false,fonts))expect(measure(line,26,p.style.font,false,fonts)).toBeLessThanOrEqual(421);
 const box=fitTextBox({...newTextBox(p,p.slides[0]),text});expect(box.w).toBe(Math.ceil(expected)+18);
 const resolved=resolveSlide(p,p.slides[0],templates,0),answer=answerOverlay(p.slides[0],resolved)!;
 expect(answer).toMatchObject(fonts);expect(nativeText(answer).some(r=>r.options?.fontFace==='Aptos')).toBe(true);
 expect(answer.w).toBeLessThan(resolved.elements.find(e=>e.id==='option-0')!.w);
 const option=resolved.elements.find(e=>e.id==='option-0')!;
 const rendered=highlightedRuns(option).reduce((sum,run)=>sum+measure(run.text,option.size!,run.font!,!!run.bold),0);
 expect(rendered).toBeCloseTo(measure(option.lines!.join('\n'),option.size!,option.font!,!!option.bold,option));
});
it('preserves both language fonts through presets and backup validation',async()=>{
 const p=sample();p.slides[0].textBoxes=[fitTextBox({...newTextBox(p,p.slides[0]),text:'हिंदी English'})];
 const preset=makeStylePreset(p,p.slides[0],'Mangal and Aptos');validateStylePreset(preset);
 expect(applyStylePreset(sample(),JSON.parse(JSON.stringify(preset))).style).toMatchObject(fonts);
 const backup=await exportProject(p),restored=await importProject(new File([await backup.arrayBuffer()],'fonts.zip'));
 expect(restored.style).toMatchObject(fonts);expect(restored.slides[0].textBoxes![0]).toMatchObject(fonts);
 expect(()=>validateProject({...p,style:{...p.style,hindiFont:'not-a-font'}})).toThrow('Invalid language font');
});
it('packs bilingual theory using mixed metrics while retaining both languages and readable sizes',()=>{
 const p=sample();p.source='# नागरिक अधिकार / Citizens rights\n\n'+Array.from({length:12},(_,i)=>'- बिंदु '+(i+1)+': सभी नागरिक कानून के समक्ष समान हैं। / All citizens are equal before the law.').join('\n');
 const slides=createTheorySlides(p,'theory-bullets').slides;expect(slides.length).toBeGreaterThan(1);
 for(const slide of slides){const r=resolveSlide(p,slide,templates,0),g=contentGeometry(p,slide);expect(r.warnings).toEqual([]);for(const e of r.elements.filter(e=>e.id.startsWith('theory-item-'))){expect(e.size).toBe(p.style.size);expect(e.y+e.h).toBeLessThanOrEqual(g.y+g.h+1);const runs=nativeText(e);if(/[A-Za-z]/.test(e.text||''))expect(runs.some(run=>run.options?.fontFace==='Aptos')).toBe(true);if(/[\u0900-\u097f]/.test(e.text||''))expect(runs.some(run=>run.options?.fontFace==='Mangal')).toBe(true);}}
});
it('adapts each slide independently and rechecks edited options and available teaching width',()=>{
 const p=sample(),short=p.slides[0],long={...short,id:'long',text:short.text.replace('A. दिल्ली / Delhi','A. यह एक बड़ा विकल्प है जिसमें अतिरिक्त विवरण दिया गया है। / This longer answer includes enough detail to need several lines.')};
 p.slides.push(long);
 const options=(s:typeof short)=>resolveSlide(p,s,templates,0).elements.filter(e=>e.id.startsWith('option-'));
 expect(options(short)[0].y).toBe(options(short)[1].y);expect(options(long)[0].x).toBe(options(long)[1].x);
 expect(options(long)[1].y).toBeGreaterThan(options(long)[0].y);
 const edited={...short,edits:{'option-1':'B. दूसरा विकल्प\nSecond option'}};
 expect(options(edited)[1].y).toBeGreaterThan(options(edited)[0].y);
 expect(options({...edited,optionsMode:'columns'})[0].y).toBe(options({...edited,optionsMode:'columns'})[1].y);
 const limited={...short,reserve:'right' as const,reserveWidth:1000};
 expect(options(limited)[1].y).toBeGreaterThan(options(limited)[0].y);
});
it('keeps highlight colours and script fonts in preview and native PPTX for MCQ, theory, table and added text',async()=>{
 const p=sample();p.style.highlight='दिल्ली / Delhi';p.style.highlightColor='#46ef5a';
 p.slides[0].textBoxes=[fitTextBox({...newTextBox(p,p.slides[0]),text:'भारत / India',y:760})];
 p.slides.push({...blankSlide(),layout:'theory',theory:{title:'नागरिक अधिकार / Citizens rights'},text:'नागरिक समान हैं। / Citizens are equal.'});
 p.slides.push({...blankSlide(),layout:'table',blocks:[{id:'t',kind:'table',text:'',answer:'',group:0,rows:[['हिंदी English'],['भारत India']]}]});
 const r=resolveSlide(p,p.slides[0],templates,0),option=r.elements.find(e=>e.id==='option-0')!;
 const marked=highlightedRuns(option).filter(run=>run.highlight);expect(marked.some(run=>run.font==='Mangal')).toBe(true);expect(marked.some(run=>run.font==='Aptos')).toBe(true);
 const html=renderToStaticMarkup(<SlideCanvas slide={r}/>);expect(html).toContain('Mangal');expect(html).toContain('Aptos');
 const bytes=await(await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:true},()=>{})).arrayBuffer(),zip=await JSZip.loadAsync(bytes);
 for(let i=1;i<=p.slides.length;i++){
  const doc=new JSDOM(await zip.file('ppt/slides/slide'+i+'.xml')!.async('string'),{contentType:'text/xml'}).window.document;
  let hi=0,en=0;
  for(const run of doc.getElementsByTagNameNS('*','r')){const text=run.getElementsByTagNameNS('*','t')[0]?.textContent||'',face=run.getElementsByTagNameNS('*','latin')[0]?.getAttribute('typeface');if(/[\u0900-\u097f]/.test(text)){expect(face).toBe('Mangal');hi++;}if(/[A-Za-z]/.test(text)){expect(face).toBe('Aptos');en++;}}
  expect(hi).toBeGreaterThan(0);expect(en).toBeGreaterThan(0);
 }
 fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/bilingual-fonts.pptx',Buffer.from(bytes));
});
