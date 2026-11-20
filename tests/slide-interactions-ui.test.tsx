// @vitest-environment jsdom
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import fs from 'node:fs';
import {newProject,blankSlide,type Project} from '../src/model';
import {ensureClassSlides,fixedSlot} from '../src/classSlides';
import {resolveSlide} from '../src/layout';
import App from '../src/App';

const state=vi.hoisted(()=>({project:null as Project|null,saved:[] as Project[]}));
vi.mock('../src/storage',async original=>({...await original<typeof import('../src/storage')>(),readImage:async()=>({id:'added-image',name:'Picture.png',width:1200,height:800,data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1EAAAAASUVORK5CYII='}),restoreProject:async()=>structuredClone(state.project),saveProject:async(p:Project)=>{state.saved.push(structuredClone(p));},getStyleLibrary:async()=>({presets:[],defaultId:''})}));
vi.mock('../src/fonts',async original=>({...await original<typeof import('../src/fonts')>(),ensureFonts:async()=>{},registerProjectFonts:async()=>{}}));
const button=(host:HTMLElement,text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===text)!;
beforeEach(()=>{
 vi.useFakeTimers();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();state.saved=[];
 const p=newProject();p.style.labelColor='#ffff00';p.slides=['First question','Second question'].map((name,index)=>({...blankSlide(),name,layout:'mcq',text:`Q.${index+1} भारत की राजधानी / Capital of India?\nA) नई दिल्ली / New Delhi\nB) Mumbai`,timer:{seconds:30,x:1300,y:700,size:180}}));state.project=ensureClassSlides(p);
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>setTimeout(()=>callback(0),0));
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 Object.defineProperty(HTMLElement.prototype,'setPointerCapture',{configurable:true,value:vi.fn()});Object.defineProperty(HTMLElement.prototype,'releasePointerCapture',{configurable:true,value:vi.fn()});
 const manifest=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8'));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json(url==='/templates/manifest.json'?manifest:{available:false,ai:false})));
});
afterEach(()=>{window.getSelection()?.removeAllRanges();delete(HTMLElement.prototype as any).setPointerCapture;delete(HTMLElement.prototype as any).releasePointerCapture;vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();delete(globalThis as any).IS_REACT_ACT_ENVIRONMENT;});
async function chooseSlide(host:HTMLElement,name:string){await act(async()=>[...host.querySelectorAll('.slide-name')].find(e=>e.childNodes[0]?.textContent===name)!.closest('button')!.click());}
async function mount(){const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);await act(async()=>root.render(<App/>));await act(async()=>(host.querySelectorAll('.panel-tabs button')[1] as HTMLButtonElement).click());await chooseSlide(host,'First question');return{host,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
async function selectText(element:HTMLElement,text:string){
 const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);
 const start=element.textContent!.indexOf(text),end=start+text.length;expect(start).toBeGreaterThanOrEqual(0);let offset=0;const range=document.createRange();
 for(const node of nodes){const next=offset+node.length;if(start>=offset&&start<next)range.setStart(node,start-offset);if(end>offset&&end<=next)range.setEnd(node,end-offset);offset=next;}
 await act(async()=>{const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
}
async function pointer(element:HTMLElement,type:string,x:number,y:number){await act(async()=>{const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:7});element.dispatchEvent(event);});}
const clock=(host:HTMLElement)=>host.querySelector('.preview-frame [aria-label="Move timer"]') as HTMLElement;

it('applies answer colour using selected/all scope without copying the correct option to other slides',async()=>{
 state.project!.slides[2].correctOption=0;state.project!.slides[3].correctOption=1;
 for(const s of state.project!.slides.filter(s=>s.layout==='mcq'))s.answerReveal=true;
 const c=await mount();try{
  await act(async()=>[...c.host.querySelectorAll('summary')].find(s=>s.textContent==='Add Answer')!.click());
  await act(async()=>button(c.host,'Preview answer highlight').click());
  const change=async(value:string)=>{const input=c.host.querySelector('[aria-label="Answer highlight colour"]') as HTMLInputElement;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>vi.advanceTimersByTimeAsync(500));};
  await change('#173b74');
  const reveal=()=>c.host.querySelector('.preview-frame [data-element="answer-reveal"]') as HTMLElement;
  expect(reveal().style.color).toBe('rgb(255, 255, 255)');expect([...reveal().querySelectorAll('span')].every(span=>span.style.color==='rgb(255, 255, 255)')).toBe(true);
  await act(async()=>button(c.host,'All slides').click());await change('#00cfee');
  expect(reveal().style.color).not.toBe('rgb(255, 255, 255)');
  let saved=state.saved.at(-1)!;expect(saved.slides[2].answerColor).toBe('#00cfee');expect(saved.slides[3].answerColor).toBe('#00cfee');
  expect(saved.slides.filter(s=>fixedSlot(s)).every(s=>s.answerColor===undefined)).toBe(true);
  expect((c.host.querySelector('.preview-frame [data-answer-background]') as HTMLElement).style.background).toBe('rgb(0, 207, 238)');
  expect(saved.slides[2].correctOption).toBe(0);expect(saved.slides[3].correctOption).toBe(1);
  await act(async()=>button(c.host,'Selected slide').click());await change('#f012be');saved=state.saved.at(-1)!;
  expect(saved.slides[2].answerColor).toBe('#f012be');expect(saved.slides[3].answerColor).toBe('#00cfee');
  await chooseSlide(c.host,'Second question');expect((c.host.querySelector('[aria-label="Answer highlight colour"]') as HTMLInputElement).value).toBe('#00cfee');
  await act(async()=>button(c.host,'All slides').click());const answer=c.host.querySelector('[aria-label="Correct answer"]') as HTMLSelectElement;
  await act(async()=>{answer.value='';answer.dispatchEvent(new Event('change',{bubbles:true}));});await act(async()=>vi.advanceTimersByTimeAsync(500));
  saved=state.saved.at(-1)!;expect(saved.slides[2].answerColor).toBe('#f012be');expect(saved.slides[2].correctOption).toBe(0);expect(saved.slides[3].correctOption).toBeUndefined();
 }finally{await c.close();}
});

it('switches header contrast with teaching templates and themes while preserving the header wording',async()=>{
 state.project!.theme.headerText='My class header';state.project!.theme.headerTextColor='#ffffff';state.project!.slides[2].theme={headerTextColor:'#ffffff'};const c=await mount();try{
  await act(async()=>[...c.host.querySelectorAll('summary')].find(s=>s.textContent==='Edit header text')!.click());
  for(const mode of ['Dark','Light']){
   await act(async()=>button(c.host,mode).click());
   for(const number of ['01','02','03']){
    await act(async()=>([...c.host.querySelectorAll('.template-card')].find(card=>card.querySelector(':scope > span')?.textContent==='Teaching · '+number) as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));
    const expected=mode==='Dark'&&number==='01'?'#292a32':'#ffffff';const heading=c.host.querySelector('.preview-frame [data-element="heading"]') as HTMLElement;
    expect(heading.textContent).toBe('My class header');expect(heading.style.color).toBe(expected==='#ffffff'?'rgb(255, 255, 255)':'rgb(41, 42, 50)');expect((c.host.querySelector('[aria-label="Header text colour"]') as HTMLInputElement).value).toBe(expected);
    const saved=state.saved.at(-1)!;expect(saved.theme.headerTextColor).toBeUndefined();expect(saved.slides.filter(s=>!fixedSlot(s)).every(s=>s.theme?.headerTextColor===undefined)).toBe(true);
   }
  }
 }finally{await c.close();}
});

it('uses Left, Center, Right buttons for Typography and header alignment with selected/all scope',async()=>{
 state.project!.theme.headerText='Header test';
 const c=await mount();try{
  const group=(label:string)=>c.host.querySelector('[role="group"][aria-label="'+label+'"]') as HTMLElement;
  const choose=async(label:string,text:string)=>{const host=group(label);expect([...host.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['Left','Center','Right']);expect(host.closest('.choice-control')!.querySelector('select')).toBeNull();await act(async()=>button(host,text).click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(host.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);expect(button(host,text).getAttribute('aria-pressed')).toBe('true');};
  await act(async()=>button(c.host,'Text').click());await act(async()=>[...c.host.querySelectorAll('summary')].find(s=>s.textContent==='Typography')!.click());
  await choose('Text alignment','Center');let saved=state.saved.at(-1)!;expect(saved.slides[2].style.align).toBe('center');expect(saved.slides[3].style.align).toBeUndefined();
  expect((c.host.querySelector('.preview-frame [data-element="question"]') as HTMLElement).style.textAlign).toBe('center');
  await act(async()=>button(c.host,'All slides').click());await choose('Text alignment','Right');saved=state.saved.at(-1)!;expect(saved.style.align).toBe('right');expect(saved.slides.every(s=>s.style.align==='right')).toBe(true);
  await act(async()=>button(c.host,'Selected slide').click());await choose('Text alignment','Left');expect(state.saved.at(-1)!.slides[3].style.align).toBe('right');
  await act(async()=>button(c.host,'Layout').click());await act(async()=>[...c.host.querySelectorAll('summary')].find(s=>s.textContent==='Edit header text')!.click());
  await choose('Header alignment','Center');saved=state.saved.at(-1)!;expect(saved.slides[2].theme?.headerAlign).toBe('center');expect(saved.slides[3].theme?.headerAlign).toBeUndefined();
  expect((c.host.querySelector('.preview-frame [data-element="heading"]') as HTMLElement).style.textAlign).toBe('center');
  await act(async()=>button(c.host,'All slides').click());await choose('Header alignment','Right');saved=state.saved.at(-1)!;expect(saved.theme.headerAlign).toBe('right');expect(saved.slides.every(s=>({...saved.theme,...s.theme}).headerAlign==='right')).toBe(true);
  await act(async()=>button(c.host,'Selected slide').click());await choose('Header alignment','Left');expect(state.saved.at(-1)!.slides[2].theme?.headerAlign).toBe('left');expect(state.saved.at(-1)!.theme.headerAlign).toBe('right');
 }finally{await c.close();}
});

it('adds timers directly with six duration buttons and keeps only the size slider with selected/all scope',async()=>{
 for(const s of state.project!.slides)s.timer=null;
 const c=await mount();try{
  await act(async()=>[...c.host.querySelectorAll('summary')].find(s=>s.textContent==='Add Timer')!.click());
  const section=c.host.querySelector('.timer-duration-grid')!.closest('details')!;
  expect([...section.querySelectorAll('.timer-duration-grid button')].map(b=>b.textContent)).toEqual(['10 SEC','20 SEC','30 SEC','60 SEC','2 MIN','3 MIN']);
  expect(section.querySelector('select')).toBeNull();expect(section.querySelector('input[type=checkbox]')).toBeNull();
  expect(section.querySelectorAll('input[type=range]')).toHaveLength(1);
  const size=section.querySelector('[aria-label="Timer size"]') as HTMLInputElement;expect(size.disabled).toBe(true);
  await act(async()=>button(c.host,'3 MIN').click());await act(async()=>vi.advanceTimersByTimeAsync(500));
  let saved=state.saved.at(-1)!;expect(saved.slides[2].timer?.seconds).toBe(180);expect(saved.slides[3].timer).toBeNull();
  expect(clock(c.host).textContent).toBe('03:00');expect(button(c.host,'3 MIN').getAttribute('aria-pressed')).toBe('true');expect(size.disabled).toBe(false);
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(size,'250');size.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>button(c.host,'60 SEC').click());await act(async()=>vi.advanceTimersByTimeAsync(500));
  expect(state.saved.at(-1)!.slides[2].timer).toMatchObject({seconds:60,size:250});expect(clock(c.host).textContent).toBe('60');
  await act(async()=>button(c.host,'All slides').click());await act(async()=>button(c.host,'20 SEC').click());await act(async()=>vi.advanceTimersByTimeAsync(500));
  saved=state.saved.at(-1)!;expect(saved.slides.filter(s=>!fixedSlot(s)).every(s=>s.timer?.seconds===20)).toBe(true);expect(saved.slides.filter(s=>fixedSlot(s)).every(s=>s.timer===null)).toBe(true);
  await act(async()=>button(c.host,'Remove timer').click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides.every(s=>s.timer===null)).toBe(true);
  await act(async()=>button(c.host,'Selected slide').click());await chooseSlide(c.host,'Welcome');
  expect([...section.querySelectorAll('button')].every(b=>b.disabled)).toBe(true);
 }finally{await c.close();}
});

it('resizes timers from their own centres to 500 px and edits face colour using selected/all scope',async()=>{
 state.project!.slides[3].timer={seconds:60,x:500,y:300,size:220,textColor:'#00ccff'};const original=structuredClone(state.project!);const c=await mount();try{
  await act(async()=>[...c.host.querySelectorAll('summary')].find(s=>s.textContent==='Add Timer')!.click());
  const size=c.host.querySelector('[aria-label="Timer size"]') as HTMLInputElement;expect(size.max).toBe('500');expect(size.closest('label')!.textContent).toContain('Timer size');
  const change=async(input:HTMLInputElement,value:string)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>vi.advanceTimersByTimeAsync(500));};
  const background=c.host.querySelector('[aria-label="Timer background colour"]') as HTMLInputElement;expect(background.value).toBe('#201114');
  const content=[...c.host.querySelectorAll('.preview-frame .slide-text')].map(e=>e.outerHTML);
  const centred=(saved:Project,index:number)=>{const before=original.slides[index].timer!,timer=saved.slides[index].timer!;expect(timer.x+timer.size/2).toBe(before.x+before.size/2);expect(timer.y+timer.size/2).toBe(before.y+before.size/2);expect(timer.seconds).toBe(before.seconds);expect(timer.textColor).toBe(before.textColor);};
  await change(size,'500');let saved=state.saved.at(-1)!;centred(saved,2);expect(saved.slides[2].timer?.size).toBe(500);expect(saved.slides[3].timer).toEqual(original.slides[3].timer);
  await change(background,'#123456');expect(clock(c.host).querySelector('circle[r="74"]')!.getAttribute('fill')).toBe('#123456');expect(state.saved.at(-1)!.slides[3].timer?.faceColor).toBeUndefined();
  await act(async()=>button(c.host,'All slides').click());await change(size,'120');await change(background,'#234567');saved=state.saved.at(-1)!;
  for(const i of [2,3]){centred(saved,i);expect(saved.slides[i].timer).toMatchObject({size:120,faceColor:'#234567'});}
  expect(saved.slides.filter(s=>fixedSlot(s)).map(s=>s.timer)).toEqual(original.slides.filter(s=>fixedSlot(s)).map(s=>s.timer));expect([...c.host.querySelectorAll('.preview-frame .slide-text')].map(e=>e.outerHTML)).toEqual(content);
  await act(async()=>button(c.host,'Selected slide').click());await act(async()=>(c.host.querySelector('[aria-label="Reset timer background colour"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));
  expect(clock(c.host).querySelector('circle[r="74"]')!.getAttribute('fill')).toBe('#201114');expect(state.saved.at(-1)!.slides[3].timer?.faceColor).toBe('#234567');
 }finally{await c.close();}
});

it('changes timer number colour with selected/all scope without changing durations or positions',async()=>{
 state.project!.slides[3].timer={seconds:60,x:500,y:300,size:220};const c=await mount();try{
  await act(async()=>[...c.host.querySelectorAll('summary')].find(s=>s.textContent==='Add Timer')!.click());
  const colour=c.host.querySelector('[aria-label="Timer text colour"]') as HTMLInputElement;
  const paint=async(value:string)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(colour,value);colour.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>vi.advanceTimersByTimeAsync(500));};
  expect(colour.value).toBe('#ffff00');await paint('#00ccff');let saved=state.saved.at(-1)!;
  expect(clock(c.host).querySelector('text')!.getAttribute('fill')).toBe('#00ccff');expect(saved.slides[2].timer?.textColor).toBe('#00ccff');expect(saved.slides[3].timer?.textColor).toBeUndefined();
  const before=saved.slides.map(s=>s.timer);await act(async()=>button(c.host,'All slides').click());expect(colour.disabled).toBe(false);await paint('#ff99cc');saved=state.saved.at(-1)!;
  for(const i of [2,3])expect(saved.slides[i].timer).toEqual({...before[i],textColor:'#ff99cc'});expect(saved.slides.filter(s=>fixedSlot(s)).map(s=>s.timer)).toEqual(before.filter((_,i)=>!!fixedSlot(saved.slides[i])));
  await act(async()=>button(c.host,'Selected slide').click());await act(async()=>(c.host.querySelector('[aria-label="Reset timer text colour"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));saved=state.saved.at(-1)!;
  expect(clock(c.host).querySelector('text')!.getAttribute('fill')).toBe('#ffff00');expect(saved.slides[2].timer?.textColor).toBeUndefined();expect(saved.slides[3].timer?.textColor).toBe('#ff99cc');
 }finally{await c.close();}
});

it('adjusts the question gap with a slider or typed value using selected/all scope and restores it',async()=>{
 const c=await mount();try{
  await act(async()=>[...c.host.querySelectorAll('summary')].find(s=>s.textContent==='Teaching layout')!.click());
  const slider=()=>c.host.querySelector('[aria-label="Question-options gap"]') as HTMLInputElement;
  const previewGap=()=>{const q=c.host.querySelector('.preview-frame [data-element="question"]') as HTMLElement,o=c.host.querySelector('.preview-frame [data-element="option-0"]') as HTMLElement;return parseFloat(o.style.top)-parseFloat(q.style.top)-parseFloat(q.style.height);};
  const change=async(value:number)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(slider(),String(value));slider().dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>vi.advanceTimersByTimeAsync(500));};
  expect(slider().type).toBe('range');expect(slider().value).toBe('36');expect(slider().getAttribute('aria-valuetext')).toBe('36 px');
  await change(64);expect(previewGap()).toBeCloseTo(64);
  let saved=state.saved.at(-1)!;expect(saved.slides[2].style.questionGap).toBe(64);expect(saved.slides[3].style.questionGap).toBeUndefined();expect(saved.style.questionGap).toBeUndefined();
  await act(async()=>button(c.host,'All slides').click());await change(24);saved=state.saved.at(-1)!;
  expect(saved.style.questionGap).toBe(24);expect(saved.slides.filter(s=>s.layout==='mcq').every(s=>s.style.questionGap===24)).toBe(true);expect(previewGap()).toBeCloseTo(24);
  await act(async()=>button(c.host,'Selected slide').click());const input=c.host.querySelector('[aria-label="Question-options gap value"]') as HTMLInputElement;
  await act(async()=>input.focus());await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'18');input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>input.blur());await act(async()=>vi.advanceTimersByTimeAsync(500));
  expect(slider().value).toBe('18');expect(previewGap()).toBeCloseTo(18);saved=state.saved.at(-1)!;
  expect(saved.slides[2].style.questionGap).toBe(18);expect(saved.slides[3].style.questionGap).toBe(24);expect(saved.style.questionGap).toBe(24);
  state.project=structuredClone(saved);
 }finally{await c.close();}
 const restored=await mount();try{
  await act(async()=>[...restored.host.querySelectorAll('summary')].find(s=>s.textContent==='Teaching layout')!.click());
  expect((restored.host.querySelector('[aria-label="Question-options gap"]') as HTMLInputElement).value).toBe('18');
  await chooseSlide(restored.host,'Second question');expect((restored.host.querySelector('[aria-label="Question-options gap"]') as HTMLInputElement).value).toBe('24');
 }finally{await restored.close();}
});

it('supports typed font sizes and full-width sliders with validation and selected/all scope',async()=>{
 state.project!.style.optionGap=14;const savedHeading=state.project!.style.titleSize;
 const c=await mount();try{
  const slide=async(label:string,value:number)=>{
   const input=c.host.querySelector('[aria-label="'+label+'"]') as HTMLInputElement;expect(input.type).toBe('range');expect(input.closest('.field-pair')).toBeNull();expect(input.closest('.field-stack')).not.toBeNull();
   await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));});
   expect(input.getAttribute('aria-valuetext')).toBe(value+' pt');expect((input.closest('.font-size-control')!.querySelector('input[type=number]') as HTMLInputElement).value).toBe(String(value));
  };
  const typeSize=async(label:string,value:string,finish:'Enter'|'Escape'|'blur'='Enter')=>{
   const input=c.host.querySelector('[aria-label="'+label+' value"]') as HTMLInputElement;expect(input.type).toBe('number');
   await act(async()=>input.focus());await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
   await act(async()=>{if(finish==='blur')input.blur();else input.dispatchEvent(new KeyboardEvent('keydown',{key:finish,bubbles:true,cancelable:true}));});
   return input;
  };
  await act(async()=>button(c.host,'Text').click());await act(async()=>[...c.host.querySelectorAll('summary')].find(s=>s.textContent==='Typography')!.click());
  expect(c.host.querySelector('[aria-label="Heading font size"]')).toBeNull();expect(c.host.querySelector('[aria-label="Option spacing"]')).toBeNull();
  await slide('Body font size',30);await slide('Options font size',28);
  expect((await typeSize('Body font size','','blur')).value).toBe('30');
  expect((await typeSize('Body font size','50','Escape')).value).toBe('30');
  expect((await typeSize('Body font size','999')).value).toBe('64');expect((c.host.querySelector('[aria-label="Body font size"]') as HTMLInputElement).value).toBe('64');
  expect((await typeSize('Body font size','1')).value).toBe('20');
  await typeSize('Body font size','30');await typeSize('Options font size','28','blur');await act(async()=>vi.advanceTimersByTimeAsync(500));
  let saved=state.saved.at(-1)!;expect(saved.slides[2].style).toMatchObject({size:30,optionSize:28});expect(saved.style.titleSize).toBe(savedHeading);expect(saved.style.optionGap).toBe(14);expect(saved.slides[3].style.size).toBeUndefined();
  await act(async()=>button(c.host,'All slides').click());await typeSize('Body font size','32');await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides.every(s=>s.style.size===32)).toBe(true);
  await act(async()=>button(c.host,'Layout').click());await act(async()=>[...c.host.querySelectorAll('summary')].find(s=>s.textContent==='Edit header text')!.click());await typeSize('Header font size','40');expect((c.host.querySelector('[aria-label="Header font size"]') as HTMLInputElement).value).toBe('40');
  await act(async()=>button(c.host,'Add Text').click());await act(async()=>(c.host.querySelector('[aria-label="Finish editing text"]') as HTMLButtonElement).click());await typeSize('Added text size','36.5');expect((c.host.querySelector('[aria-label="Added text size"]') as HTMLInputElement).value).toBe('36.5');await act(async()=>vi.advanceTimersByTimeAsync(500));
  saved=state.saved.at(-1)!;expect(saved.theme.headerFontSize).toBe(40);expect(saved.slides.every(s=>({...saved.theme,...s.theme}).headerFontSize===40)).toBe(true);expect(saved.slides[2].textBoxes![0].size).toBe(36.5);expect(saved.slides[3].textBoxes![0].size).toBe(36.5);
 }finally{await c.close();}
});

it.each(['mcq','theory'] as const)('moves the timer across %s text without changing text layout, font size, content or slide count',async layout=>{
 if(layout==='theory')for(const slide of state.project!.slides.filter(s=>!s.fixedSlot)){slide.layout='theory';slide.theory={title:'संविधान / Constitution'};slide.text=Array.from({length:3},(_,i)=>`यह बिंदु ${i+1} नागरिकों के अधिकारों की रक्षा करता है। / This point protects the rights of citizens.`).join('\n\n');slide.style={bullets:true};}
 const c=await mount();try{
  await act(async()=>vi.advanceTimersByTimeAsync(500));const before=state.saved.at(-1)!;
  const manifest=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8'));
  const textSnapshot=()=>[...c.host.querySelectorAll('.preview-frame .slide-text')].map(e=>e.outerHTML);
  const textBefore=textSnapshot(),withoutTimers=(p:Project)=>p.slides.map(s=>{const {timer,...rest}=s;return rest;});
  for(const all of [false,true]){
   if(all)await act(async()=>button(c.host,'All slides').click());
   for(const [x,y] of [[80,160],[900,400],[1400,700]]){
    const timer=clock(c.host),dx=(x-parseFloat(timer.style.left))*.4,dy=(y-parseFloat(timer.style.top))*.4;
    await pointer(timer,'pointerdown',100,100);await pointer(timer,'pointermove',100+dx,100+dy);expect(textSnapshot()).toEqual(textBefore);
    await pointer(timer,'pointerup',100+dx,100+dy);await act(async()=>vi.advanceTimersByTimeAsync(500));
    const after=state.saved.at(-1)!;expect(withoutTimers(after)).toEqual(withoutTimers(before));expect(textSnapshot()).toEqual(textBefore);
    for(let i=0;i<after.slides.length;i++)expect(resolveSlide(after,after.slides[i],manifest,i).elements.filter(e=>e.kind!=='timer')).toEqual(resolveSlide(before,before.slides[i],manifest,i).elements.filter(e=>e.kind!=='timer'));
   }
  }
 }finally{await c.close();}
});

it('highlights text selected on the actual slide after opening the sidebar, saves it and supports undo',async()=>{
 const c=await mount();try{
  const question=c.host.querySelector('.preview-frame [data-element="question"]') as HTMLElement;
  await selectText(question,'भारत की राजधानी');
  await act(async()=>button(c.host,'Text').click());await act(async()=>[...c.host.querySelectorAll('summary')].find(e=>e.textContent==='Keyword highlight')!.click());
  expect(button(c.host,'Highlight').disabled).toBe(false);await act(async()=>button(c.host,'Highlight').click());
  expect([...question.querySelectorAll('mark')].map(e=>e.textContent).join('')).toBe('भारत की राजधानी');
  expect(c.host.querySelector('input[placeholder="Enter a word or phrase"]')).toHaveProperty('value','भारत की राजधानी');
  await act(async()=>vi.advanceTimersByTimeAsync(500));const saved=state.saved.at(-1)!;expect(saved.slides[2].style.highlight).toBe('भारत की राजधानी');expect(saved.slides[3].style.highlight).toBeUndefined();
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());expect(question.querySelector('mark')).toBeNull();
  await selectText(question,'Capital of India');await chooseSlide(c.host,'Second question');expect(button(c.host,'Highlight').disabled).toBe(true);
 }finally{await c.close();}
});

it('finishes an inline text edit before applying its selected keyword, without losing the edit',async()=>{
 const c=await mount();try{
  await act(async()=>button(c.host,'Text').click());const question=c.host.querySelector('.preview-frame [data-element="question"]') as HTMLElement;
  await act(async()=>question.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));await act(async()=>vi.advanceTimersByTimeAsync(1));
  expect(document.activeElement).toBe(question);question.textContent='Q.1 नई दिल्ली / New Delhi?';Object.defineProperty(question,'innerText',{configurable:true,get:()=>question.textContent});
  await selectText(question,'नई दिल्ली');await act(async()=>button(c.host,'Highlight').click());
  expect(question.getAttribute('contenteditable')).toBe('false');expect(question.textContent).toContain('New Delhi?');expect(question.querySelector('mark')?.textContent).toBe('नई दिल्ली');
  await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides[2].edits.question).toBe('Q.1 नई दिल्ली / New Delhi?');
 }finally{await c.close();}
});

it('uses the existing All slides scope for selected keywords without selecting sidebar or thumbnail text',async()=>{
 const c=await mount();try{
  await act(async()=>button(c.host,'Text').click());expect(button(c.host,'Highlight').disabled).toBe(true);
  await selectText([...c.host.querySelectorAll('.slide-name')].find(e=>e.textContent==='First question') as HTMLElement,'First question');expect(button(c.host,'Highlight').disabled).toBe(true);
  await act(async()=>button(c.host,'All slides').click());await selectText(c.host.querySelector('.preview-frame [data-element="option-0"]') as HTMLElement,'New Delhi');
  await act(async()=>button(c.host,'Highlight').click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides.every(s=>s.style.highlight==='New Delhi')).toBe(true);
  await chooseSlide(c.host,'Second question');expect(c.host.querySelector('.preview-frame mark')?.textContent).toBe('New Delhi');
 }finally{await c.close();}
});

it('drags at the current zoom, commits once on release, saves only the selected timer and undoes in one step',async()=>{
 const c=await mount();try{
  const timer=clock(c.host);await pointer(timer,'pointerdown',100,100);await pointer(timer,'pointermove',120,140);
  expect(timer.style.left).toBe('1350px');expect(timer.style.top).toBe('800px');
  await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides[2].timer?.x).toBe(1300);
  await pointer(timer,'pointerup',120,140);await act(async()=>vi.advanceTimersByTimeAsync(500));const latest=state.saved.at(-1)!;
  expect(latest.slides[2].timer).toMatchObject({x:1350,y:800,seconds:30,size:180});expect(latest.slides[3].timer?.x).toBe(1300);
  expect(clock(c.host).textContent).toBe('30');await act(async()=>clock(c.host).dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true})));expect(clock(c.host).style.left).toBe('1300px');expect(clock(c.host).style.top).toBe('700px');
 }finally{await c.close();}
});

it('clamps drag movement, preserves covers and updates all teaching timers when All slides is active',async()=>{
 const c=await mount();try{
  await act(async()=>button(c.host,'All slides').click());const timer=clock(c.host);await pointer(timer,'pointerdown',100,100);await pointer(timer,'pointerup',10000,-10000);
  await act(async()=>vi.advanceTimersByTimeAsync(500));const latest=state.saved.at(-1)!;
  for(const slide of latest.slides.filter(s=>!s.fixedSlot))expect(slide.timer).toMatchObject({x:1740,y:0});for(const slide of latest.slides.filter(s=>s.fixedSlot))expect(slide.timer).toBeNull();
  await chooseSlide(c.host,'Second question');expect(clock(c.host).style.left).toBe('1740px');
 }finally{await c.close();}
});

it('cancels pointer movement without saving and keeps presentation timers non-draggable',async()=>{
 const c=await mount();try{
  const timer=clock(c.host);await pointer(timer,'pointerdown',100,100);await pointer(timer,'pointermove',180,100);await pointer(timer,'pointercancel',180,100);expect(timer.style.left).toBe('1300px');
  await act(async()=>timer.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true})));expect(clock(c.host).style.left).toBe('1301px');
  await act(async()=>button(c.host,'Present').click());expect(c.host.querySelectorAll('[aria-label="Move timer"]')).toHaveLength(1);
  const presentation=c.host.querySelector('.presentation-overlay');expect(presentation).not.toBeNull();expect(presentation?.querySelector('[aria-label="Move timer"]')).toBeNull();
 }finally{await c.close();}
});

async function uploadPicture(host:HTMLElement){const input=host.querySelector('input[aria-label="Add Image"]') as HTMLInputElement;expect(input.closest('details')).toBeNull();await act(async()=>{Object.defineProperty(input,'files',{configurable:true,value:[new File(['image'],'Picture.png',{type:'image/png'})]});input.dispatchEvent(new Event('change',{bubbles:true}));});}
it('adds, drags, resizes, crops and removes an image while preserving text and one-step undo',async()=>{
 const c=await mount();try{
  const question=c.host.querySelector('.preview-frame [data-element="question"]')!.outerHTML;await uploadPicture(c.host);await act(async()=>button(c.host,'All slides').click());
  const picture=()=>c.host.querySelector('.preview-frame [data-slide-image]') as HTMLElement;expect(picture().style.width).toBe('640px');expect(c.host.querySelector('.preview-frame [data-element="question"]')!.outerHTML).toBe(question);
  await pointer(picture(),'pointerdown',100,100);await pointer(picture(),'pointerup',20,80);expect(picture().style.left).toBe('1000px');expect(picture().style.top).toBe('170px');
  const corner=picture().querySelector('[aria-label="Resize image se"]') as HTMLElement;await pointer(corner,'pointerdown',100,100);await pointer(picture(),'pointerup',140,120);expect(parseFloat(picture().style.width)).toBeCloseTo(740);expect(parseFloat(picture().style.width)/parseFloat(picture().style.height)).toBeCloseTo(1.5);
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());expect(picture().style.width).toBe('640px');
  await act(async()=>button(c.host,'Crop image').click());const stage=c.host.querySelector('.crop-stage') as HTMLElement;stage.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:600,bottom:400,width:600,height:400,toJSON(){}} as DOMRect);
  await pointer(stage.querySelector('[aria-label="Crop corner se"]') as HTMLElement,'pointerdown',600,400);await pointer(stage,'pointerup',300,200);await act(async()=>button(c.host,'Apply crop').click());
  await act(async()=>vi.advanceTimersByTimeAsync(500));let saved=state.saved.at(-1)!;expect(saved.slides[2].imagePlacement?.crop).toEqual({x:0,y:0,w:.5,h:.5});expect(saved.slides[3].image).toBeUndefined();expect(saved.slides[2].layout).toBe('mcq');expect(c.host.querySelector('.preview-frame [data-element="question"]')!.outerHTML).toBe(question);
  await act(async()=>(c.host.querySelector('[aria-label="Remove image"]') as HTMLButtonElement).click());expect(picture()).toBeNull();await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());expect(picture()).not.toBeNull();
 }finally{await c.close();}
});
it('fits the whole thumbnail without crop controls or transform handles',async()=>{
 const c=await mount();try{
  await chooseSlide(c.host,'Thumbnail');await uploadPicture(c.host);const picture=c.host.querySelector('.preview-frame [data-slide-image]') as HTMLElement;await act(async()=>picture.click());
  expect(picture.style.width).toBe('1920px');const view=picture.firstElementChild as HTMLElement;expect(view.style.left).toBe('150px');expect(view.style.width).toBe('1620px');expect(view.style.height).toBe('1080px');
  expect(picture.querySelector('[aria-label^="Resize image"]')).toBeNull();expect(button(c.host,'Crop image')).toBeUndefined();expect(button(c.host,'Fill frame')).toBeUndefined();
 }finally{await c.close();}
});

it('deletes only the selected image with Delete, preserves other slides and restores exact crop with Undo',async()=>{
 const c=await mount();try{
  await uploadPicture(c.host);
  const picture=()=>c.host.querySelector('.preview-frame [data-slide-image]') as HTMLElement;
  await pointer(picture(),'pointerdown',100,100);await pointer(picture(),'pointerup',60,80);await act(async()=>vi.advanceTimersByTimeAsync(500));
  const before=structuredClone(state.saved.at(-1)!);expect(document.activeElement).toBe(picture());
  await act(async()=>picture().dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true})));
  expect(picture()).toBeNull();await act(async()=>vi.advanceTimersByTimeAsync(500));const after=state.saved.at(-1)!;
  expect(after.slides).toHaveLength(before.slides.length);expect(after.slides[2].image).toBeUndefined();expect(after.slides[2].imagePlacement).toBeUndefined();expect(after.slides[2].text).toBe(before.slides[2].text);expect(after.slides[3]).toEqual(before.slides[3]);
  await act(async()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true})));await act(async()=>vi.advanceTimersByTimeAsync(500));
  expect(state.saved.at(-1)!.slides).toEqual(before.slides);expect(picture()).not.toBeNull();
 }finally{await c.close();}
});
it('does not delete an image while editing text, typing in settings or when the image is locked',async()=>{
 const c=await mount();try{
  await uploadPicture(c.host);const picture=()=>c.host.querySelector('.preview-frame [data-slide-image]') as HTMLElement;
  await act(async()=>picture().click());const question=c.host.querySelector('.preview-frame [data-element="question"]') as HTMLElement;
  await act(async()=>question.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));await act(async()=>vi.advanceTimersByTimeAsync(1));
  await act(async()=>question.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));expect(picture()).not.toBeNull();
  await act(async()=>button(c.host,'Text').click());const input=c.host.querySelector('textarea[aria-label="Slide text"]') as HTMLElement;
  await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));expect(picture()).not.toBeNull();
  await act(async()=>picture().click());const lock=[...c.host.querySelectorAll('label')].find(e=>e.textContent?.includes('Lock “content-image”'))!.querySelector('input')!;
  await act(async()=>lock.click());await act(async()=>picture().dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));expect(picture()).not.toBeNull();
 }finally{await c.close();}
});
it('keeps Add Image directly below Teaching space, outside collapsed sections, and supports thumbnail deletion',async()=>{
 const c=await mount();try{
  for(const tab of ['Layout','Text']){await act(async()=>button(c.host,tab).click());const tools=c.host.querySelector('.image-tools')!;expect(tools.parentElement).toBe(c.host.querySelector('.settings-body'));expect(tools.closest('details')).toBeNull();expect(tools.previousElementSibling?.querySelector('summary')?.textContent).toBe(tab==='Layout'?'Teaching space':'Slide content');}
  await chooseSlide(c.host,'Thumbnail');await uploadPicture(c.host);const picture=c.host.querySelector('.preview-frame [data-slide-image]') as HTMLElement;
  await act(async()=>picture.click());await act(async()=>picture.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true})));expect(c.host.querySelector('.preview-frame [data-slide-image]')).toBeNull();
  await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides[1].fixedSlot).toBe('thumbnail');expect(state.saved.at(-1)!.slides[1].image).toBeUndefined();
 }finally{await c.close();}
});

it('applies one upload to all content slides when viewing a teaching slide, preserves fixed covers and undoes in one step',async()=>{const selected='First question';
 const project=state.project!,oldAsset={id:'old-image',name:'Existing.png',width:1200,height:800,data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1EAAAAASUVORK5CYII='};project.assets[oldAsset.id]=oldAsset;
 project.slides.splice(project.slides.length-1,0,{...blankSlide(),name:'Theory',layout:'theory',text:'A complete theory point.'},{...blankSlide(5),name:'Home Work',kind:'original'});
 for(const slide of project.slides){slide.image=oldAsset.id;slide.imagePlacement={x:20,y:30,w:400,h:300,fit:'contain',crop:{x:.1,y:.1,w:.8,h:.8}};}
 const c=await mount();try{
  await chooseSlide(c.host,selected);await act(async()=>button(c.host,'All slides').click());await act(async()=>vi.advanceTimersByTimeAsync(500));const before=structuredClone(state.saved.at(-1)!);
  const manifest=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')),withoutPicture=(p:Project,i:number)=>resolveSlide(p,p.slides[i],manifest,i).elements.filter(e=>e.id!=='content-image'&&!e.id.startsWith('image-'));
  await uploadPicture(c.host);await act(async()=>vi.advanceTimersByTimeAsync(500));const after=state.saved.at(-1)!;expect(after.slides).toHaveLength(before.slides.length);
  for(const [i,slide] of after.slides.entries()){
   if(fixedSlot(slide)){expect(slide).toEqual(before.slides[i]);continue;}
   expect(slide.image).toBe('old-image');expect(slide.imagePlacement).toEqual(before.slides[i].imagePlacement);expect(slide.images![0].assetId).toBe('added-image');expect(slide.images![0].placement).toMatchObject({x:1168,y:252,w:640,fit:'contain',crop:{x:0,y:0,w:1,h:1}});expect(slide.layout).toBe(before.slides[i].layout);expect(slide.text).toBe(before.slides[i].text);expect(withoutPicture(after,i)).toEqual(withoutPicture(before,i));
  }
  expect(after.slides.find(s=>s.name==='Home Work')?.images?.[0].assetId).toBe('added-image');expect(after.slides.filter(s=>!fixedSlot(s))).toHaveLength(4);expect(after.assets['added-image']).toBeDefined();
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides).toEqual(before.slides);expect(state.saved.at(-1)!.assets).toEqual(before.assets);
 }finally{await c.close();}
});

it('scales Fill frame to the entire slide, preserves crop and text, and restores prior placement with Undo',async()=>{
 const c=await mount();try{
  await uploadPicture(c.host);const picture=()=>c.host.querySelector('.preview-frame [data-slide-image]') as HTMLElement;
  await pointer(picture(),'pointerdown',100,100);await pointer(picture(),'pointerup',60,80);
  await act(async()=>button(c.host,'Crop image').click());const stage=c.host.querySelector('.crop-stage') as HTMLElement;stage.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:600,bottom:400,width:600,height:400,toJSON(){}} as DOMRect);
  await pointer(stage.querySelector('[aria-label="Crop corner nw"]') as HTMLElement,'pointerdown',0,0);await pointer(stage,'pointerup',120,80);await act(async()=>button(c.host,'Apply crop').click());await act(async()=>vi.advanceTimersByTimeAsync(500));
  const before=structuredClone(state.saved.at(-1)!);await act(async()=>button(c.host,'Fill frame').click());await act(async()=>vi.advanceTimersByTimeAsync(500));const after=state.saved.at(-1)!;
  expect(after.slides[2].imagePlacement).toEqual({...before.slides[2].imagePlacement,x:0,y:0,w:1920,h:1080,fit:'cover'});expect(after.slides[2].text).toBe(before.slides[2].text);expect(after.slides[3]).toEqual(before.slides[3]);
  expect(picture().style.left).toBe('0px');expect(picture().style.top).toBe('0px');expect(picture().style.width).toBe('1920px');expect(picture().style.height).toBe('1080px');const img=picture().querySelector('img')!;expect(parseFloat(img.style.width)/parseFloat(img.style.height)).toBeCloseTo(1.5);expect(button(c.host,'Fit image')).toBeDefined();
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides[2].imagePlacement).toEqual(before.slides[2].imagePlacement);
 }finally{await c.close();}
});

it('edits position, size, crop and fill on all content images together while preserving covers and Selected slide isolation',async()=>{
 const project=state.project!;project.slides.splice(project.slides.length-1,0,{...blankSlide(5),kind:'original',name:'Home Work'});
 const c=await mount();try{
  await chooseSlide(c.host,'Thumbnail');await uploadPicture(c.host);await chooseSlide(c.host,'First question');await act(async()=>button(c.host,'All slides').click());await uploadPicture(c.host);await act(async()=>vi.advanceTimersByTimeAsync(500));
  const before=structuredClone(state.saved.at(-1)!),fixed=before.slides.filter(s=>fixedSlot(s));const picture=()=>c.host.querySelector('.preview-frame [data-slide-image]') as HTMLElement;
  const saved=async()=>{await act(async()=>vi.advanceTimersByTimeAsync(500));return state.saved.at(-1)!;};
  const checkAll=(p:Project)=>{const slides=p.slides.filter(s=>!fixedSlot(s));for(const s of slides)expect(s.imagePlacement).toEqual(slides[0].imagePlacement);expect(p.slides.filter(s=>fixedSlot(s))).toEqual(fixed);expect(p.slides.map(s=>s.text)).toEqual(before.slides.map(s=>s.text));};
  await pointer(picture(),'pointerdown',100,100);await pointer(picture(),'pointerup',60,80);let next=await saved();checkAll(next);expect(next.slides[2].imagePlacement).toMatchObject({x:1100,y:170});
  await pointer(picture().querySelector('[aria-label="Resize image se"]') as HTMLElement,'pointerdown',100,100);await pointer(picture(),'pointerup',140,120);next=await saved();checkAll(next);expect(next.slides[2].imagePlacement?.w).toBeCloseTo(740);
  await act(async()=>button(c.host,'Crop image').click());const stage=c.host.querySelector('.crop-stage') as HTMLElement;stage.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:600,bottom:400,width:600,height:400,toJSON(){}} as DOMRect);
  await pointer(stage.querySelector('[aria-label="Crop corner nw"]') as HTMLElement,'pointerdown',0,0);await pointer(stage,'pointerup',120,80);await act(async()=>button(c.host,'Apply crop').click());next=await saved();checkAll(next);for(const [key,value] of Object.entries({x:.2,y:.2,w:.8,h:.8}))expect(next.slides[2].imagePlacement!.crop![key as 'x'|'y'|'w'|'h']).toBeCloseTo(value);const cropped=structuredClone(next);
  await act(async()=>button(c.host,'Fill frame').click());next=await saved();checkAll(next);expect(next.slides[2].imagePlacement).toMatchObject({x:0,y:0,w:1920,h:1080,fit:'cover'});
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());next=await saved();expect(next.slides).toEqual(cropped.slides);
  await act(async()=>button(c.host,'Selected slide').click());await pointer(picture(),'pointerdown',100,100);await pointer(picture(),'pointerup',80,80);next=await saved();expect(next.slides[2].imagePlacement).not.toEqual(cropped.slides[2].imagePlacement);expect(next.slides.filter((_,i)=>i!==2)).toEqual(cropped.slides.filter((_,i)=>i!==2));
 }finally{await c.close();}
});

it.each([
 ['All slides','First question'],['All slides','Thumbnail'],
 ['Selected slide','First question'],['Selected slide','Thumbnail']
])('deletes images using %s from %s, preserves excluded slides and restores all placements with Undo',async(scope,selected)=>{
 const project=state.project!;project.slides.splice(project.slides.length-1,0,{...blankSlide(),name:'Theory',layout:'theory',text:'A complete theory point.'},{...blankSlide(5),kind:'original',name:'Home Work'},{...blankSlide(),name:'No image'});
 project.slides.forEach((slide,i)=>{if(slide.name==='No image')return;const id='existing-'+i;project.assets[id]={id,name:id+'.png',width:1200,height:800,data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1EAAAAASUVORK5CYII='};slide.image=id;slide.imagePlacement={x:20+i*10,y:100,w:400,h:300,fit:'contain',crop:{x:.1,y:.1,w:.8,h:.8}};});
 const c=await mount();try{
  await chooseSlide(c.host,selected);await act(async()=>button(c.host,scope).click());await act(async()=>vi.advanceTimersByTimeAsync(500));const before=structuredClone(state.saved.at(-1)!),selectedId=before.slides.find(s=>s.name===selected)!.id;
  const picture=c.host.querySelector('.preview-frame [data-slide-image]') as HTMLElement;await act(async()=>picture.click());expect(document.activeElement).toBe(picture);
  await act(async()=>picture.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true})));await act(async()=>vi.advanceTimersByTimeAsync(500));const after=state.saved.at(-1)!;
  const manifest=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8'));expect(after.slides).toHaveLength(before.slides.length);expect(after.assets).toEqual(before.assets);
  for(const [i,slide] of after.slides.entries()){
   const removed=scope==='All slides'&&selected!=='Thumbnail'?!fixedSlot(before.slides[i])&&!!before.slides[i].image:slide.id===selectedId;
   if(!removed){expect(slide).toEqual(before.slides[i]);continue;}
   expect(slide).toEqual({...before.slides[i],image:undefined,imagePlacement:undefined,manual:true});expect(resolveSlide(after,slide,manifest,i).elements.some(e=>e.id==='content-image')).toBe(false);
  }
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides).toEqual(before.slides);
  await act(async()=>(c.host.querySelector('[aria-label="Redo"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides).toEqual(after.slides);
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides).toEqual(before.slides);
 }finally{await c.close();}
});

async function typeAddedText(host:HTMLElement,value:string){const input=host.querySelector('.preview-frame textarea[aria-label="Edit added text"]') as HTMLTextAreaElement;expect(input).not.toBeNull();await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
const textBox=(host:HTMLElement)=>host.querySelector('.preview-frame [data-text-box]') as HTMLElement;
it('adds inline text below Add Image, saves typing, drags/scales independently and deletes with one-step Undo',async()=>{
 const c=await mount();try{
  expect(c.host.querySelector('.text-tools')!.previousElementSibling).toBe(c.host.querySelector('.image-tools'));
  const original=c.host.querySelector('.preview-frame [data-element="question"]')!.outerHTML;
  await act(async()=>button(c.host,'Add Text').click());expect(document.activeElement?.getAttribute('aria-label')).toBe('Edit added text');
  await typeAddedText(c.host,'भारत / India');await typeAddedText(c.host,'भारत / India\nMy class');await act(async()=>vi.advanceTimersByTimeAsync(500));
  expect(state.saved.at(-1)!.slides[2].textBoxes?.[0].text).toBe('भारत / India\nMy class');expect(state.saved.at(-1)!.slides[3].textBoxes).toBeUndefined();
  await act(async()=>(c.host.querySelector('.preview-frame [aria-label="Finish editing text"]') as HTMLButtonElement).click());
  const box=textBox(c.host);await pointer(box.querySelector('[aria-label="Move text box"]') as HTMLElement,'pointerdown',100,100);await pointer(box,'pointermove',140,120);await pointer(box,'pointerup',140,120);expect(textBox(c.host).style.left).toBe('220px');expect(textBox(c.host).style.top).toBe('270px');
  const beforeResize=state.saved.at(-1)!.slides[2].textBoxes![0];await pointer(textBox(c.host).querySelector('[aria-label="Resize text box se"]') as HTMLElement,'pointerdown',100,100);await pointer(textBox(c.host),'pointerup',180,100);await act(async()=>vi.advanceTimersByTimeAsync(500));let saved=state.saved.at(-1)!;
  expect(saved.slides[2].textBoxes![0].w).toBeGreaterThan(beforeResize.w);expect(saved.slides[2].textBoxes![0].size).toBeCloseTo(beforeResize.size*(beforeResize.w+200)/beforeResize.w);expect(c.host.querySelector('.preview-frame [data-element="question"]')!.outerHTML).toBe(original);
  await act(async()=>textBox(c.host).click());expect(c.host.querySelector('textarea[aria-label="Edit added text"]')).not.toBeNull();
  await act(async()=>c.host.querySelector('textarea[aria-label="Edit added text"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));expect(textBox(c.host)).not.toBeNull();
  await act(async()=>(c.host.querySelector('.preview-frame [aria-label="Finish editing text"]') as HTMLButtonElement).click());await act(async()=>textBox(c.host).dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true})));expect(textBox(c.host)).toBeNull();
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides[2].textBoxes).toEqual(saved.slides[2].textBoxes);
 }finally{await c.close();}
});
it('shares only the corresponding text box across All slides, excludes covers, and supports selected-only changes',async()=>{
 const p=state.project!;p.slides.splice(p.slides.length-1,0,{...blankSlide(5),kind:'original',name:'Home Work'});
 const c=await mount();try{
  await chooseSlide(c.host,'Thumbnail');await act(async()=>button(c.host,'Add Text').click());await typeAddedText(c.host,'Thumbnail text');await act(async()=>(c.host.querySelector('.preview-frame [aria-label="Finish editing text"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));const cover=structuredClone(state.saved.at(-1)!.slides[1]);
  await act(async()=>button(c.host,'All slides').click());await act(async()=>button(c.host,'Add Text').click());await typeAddedText(c.host,'Shared heading');await act(async()=>(c.host.querySelector('.preview-frame [aria-label="Finish editing text"]') as HTMLButtonElement).click());
  await pointer(textBox(c.host).querySelector('[aria-label="Move text box"]') as HTMLElement,'pointerdown',100,100);await pointer(textBox(c.host),'pointerup',180,120);await act(async()=>vi.advanceTimersByTimeAsync(500));let saved=state.saved.at(-1)!;
  const content=saved.slides.filter(s=>!fixedSlot(s));expect(content).toHaveLength(3);for(const s of content)expect(s.textBoxes).toEqual(content[0].textBoxes);expect(saved.slides[1]).toEqual(cover);expect(saved.slides[0].textBoxes).toBeUndefined();expect(saved.slides.at(-1)!.textBoxes).toBeUndefined();
  const shared=content[0].textBoxes![0];await act(async()=>button(c.host,'Selected slide').click());await act(async()=>button(c.host,'Add Text').click());await typeAddedText(c.host,'Local note');await act(async()=>(c.host.querySelector('.preview-frame [aria-label="Finish editing text"]') as HTMLButtonElement).click());
  const sharedBox=c.host.querySelector('.preview-frame [data-text-box="'+shared.id+'"]') as HTMLElement;await act(async()=>sharedBox.click());await typeAddedText(c.host,'Local shared edit');await act(async()=>(c.host.querySelector('.preview-frame [aria-label="Finish editing text"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));saved=state.saved.at(-1)!;expect(saved.slides[2].textBoxes![0].text).toBe('Local shared edit');expect(saved.slides[3].textBoxes![0].text).toBe('Shared heading');
  await act(async()=>button(c.host,'All slides').click());await act(async()=>sharedBox.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true})));await act(async()=>vi.advanceTimersByTimeAsync(500));saved=state.saved.at(-1)!;expect(saved.slides.filter(s=>!fixedSlot(s)).every(s=>!s.textBoxes?.some(b=>b.id===shared.id))).toBe(true);expect(saved.slides[2].textBoxes?.[0].text).toBe('Local note');expect(saved.slides[1]).toEqual(cover);
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides[3].textBoxes![0].id).toBe(shared.id);
 }finally{await c.close();}
});

it('formats the selected added text without changing MCQs, cancels drag, and respects text locks',async()=>{
 const c=await mount();try{
  const original=c.host.querySelector('.preview-frame [data-element="question"]')!.outerHTML;await act(async()=>button(c.host,'Add Text').click());await typeAddedText(c.host,'Important / महत्वपूर्ण');await act(async()=>(c.host.querySelector('.preview-frame [aria-label="Finish editing text"]') as HTMLButtonElement).click());
  for(const [label,value] of [['Added text font','Mangal'],['Added text alignment','right']])await act(async()=>{const input=c.host.querySelector('[aria-label="'+label+'"]') as HTMLSelectElement;input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));});
  for(const [label,value] of [['Added text size','36'],['Added text colour','#ffff00']])await act(async()=>{const input=c.host.querySelector('[aria-label="'+label+'"]') as HTMLInputElement;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>vi.advanceTimersByTimeAsync(500));const before=structuredClone(state.saved.at(-1)!),box=before.slides[2].textBoxes![0];expect(box).toMatchObject({font:'Mangal',bold:true,size:36,align:'right',color:'#ffff00'});expect(c.host.querySelector('.preview-frame [data-element="question"]')!.outerHTML).toBe(original);
  await pointer(textBox(c.host).querySelector('[aria-label="Move text box"]') as HTMLElement,'pointerdown',100,100);await pointer(textBox(c.host),'pointermove',400,400);await pointer(textBox(c.host),'pointercancel',400,400);expect(textBox(c.host).style.left).toBe(box.x+'px');
  await act(async()=>button(c.host,'Text').click());const lock=[...c.host.querySelectorAll('label')].find(e=>e.textContent?.includes('Lock “text-box-'))!.querySelector('input')!;await act(async()=>lock.click());await act(async()=>textBox(c.host).click());expect(c.host.querySelector('textarea[aria-label="Edit added text"]')).toBeNull();await act(async()=>textBox(c.host).dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));expect(textBox(c.host)).not.toBeNull();
 }finally{await c.close();}
});

it('keeps the current teaching slide when adding text with All slides selected',async()=>{
 const c=await mount();try{await chooseSlide(c.host,'Second question');await act(async()=>button(c.host,'All slides').click());await act(async()=>button(c.host,'Add Text').click());expect(c.host.querySelector('.canvas-toolbar h2')?.textContent).toBe('Second question');await typeAddedText(c.host,'Current slide');await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides[3].textBoxes![0].text).toBe('Current slide');expect(state.saved.at(-1)!.slides[2].textBoxes![0].text).toBe('Current slide');}finally{await c.close();}
});

it('grows and shrinks the text box live while typing without accumulating bottom space, including All slides',async()=>{
 const c=await mount();try{
  const original=c.host.querySelector('.preview-frame [data-element="question"]')!.outerHTML;await act(async()=>button(c.host,'All slides').click());await act(async()=>button(c.host,'Add Text').click());const emptyHeight=parseFloat(textBox(c.host).style.height);
  await typeAddedText(c.host,'एक लाइन / One line');const oneHeight=parseFloat(textBox(c.host).style.height);expect(oneHeight).toBe(emptyHeight);expect(oneHeight).toBeLessThan(100);
  await typeAddedText(c.host,'एक लाइन / One line\nSecond line\nThird line');const threeHeight=parseFloat(textBox(c.host).style.height);expect(threeHeight).toBeGreaterThan(oneHeight*2);await act(async()=>vi.advanceTimersByTimeAsync(500));const grown=state.saved.at(-1)!;expect(grown.slides[2].textBoxes?.[0].h).toBe(threeHeight);expect(grown.slides[3].textBoxes?.[0].h).toBe(threeHeight);
  await typeAddedText(c.host,'Short');expect(parseFloat(textBox(c.host).style.height)).toBe(oneHeight);await typeAddedText(c.host,'');expect(parseFloat(textBox(c.host).style.height)).toBe(emptyHeight);await act(async()=>vi.advanceTimersByTimeAsync(500));const shrunk=state.saved.at(-1)!;expect(shrunk.slides[2].textBoxes?.[0].h).toBe(oneHeight);expect(shrunk.slides[3].textBoxes?.[0].h).toBe(oneHeight);expect(c.host.querySelector('.preview-frame [data-element="question"]')!.outerHTML).toBe(original);
 }finally{await c.close();}
});

it('grows and shrinks added text width live and syncs All slides without moving the box or teaching text',async()=>{
 const c=await mount();try{
  const original=c.host.querySelector('.preview-frame [data-element="question"]')!.outerHTML;
  await act(async()=>button(c.host,'All slides').click());await act(async()=>button(c.host,'Add Text').click());
  await typeAddedText(c.host,'Hi');const small=parseFloat(textBox(c.host).style.width),left=textBox(c.host).style.left;expect(small).toBeLessThan(120);
  await typeAddedText(c.host,'भारत / India - A longer class heading');const wide=parseFloat(textBox(c.host).style.width);expect(wide).toBeGreaterThan(small);expect(textBox(c.host).style.left).toBe(left);
  await typeAddedText(c.host,Array(20).fill('Long teaching content').join(' '));expect(parseFloat(textBox(c.host).style.width)).toBe(1920-parseFloat(left));expect(parseFloat(textBox(c.host).style.height)).toBeGreaterThan(100);
  await typeAddedText(c.host,'Hi');expect(parseFloat(textBox(c.host).style.width)).toBe(small);expect(textBox(c.host).style.left).toBe(left);
  await act(async()=>vi.advanceTimersByTimeAsync(500));const saved=state.saved.at(-1)!;expect(saved.slides[2].textBoxes![0].w).toBe(small);expect(saved.slides[3].textBoxes).toEqual(saved.slides[2].textBoxes);expect(c.host.querySelector('.preview-frame [data-element="question"]')!.outerHTML).toBe(original);
 }finally{await c.close();}
});
it('restores red labels on every Light click and yellow on Dark across all MCQ slides',async()=>{
 for(const s of state.project!.slides.filter(s=>!fixedSlot(s))){s.style.labelColor='#0000ff';s.text+='\nC) Kolkata\nD) Chennai';}
 const c=await mount();try{
  for(const name of ['Light','Dark','Light','Light']){
   await act(async()=>button(c.host,name).click());await act(async()=>vi.advanceTimersByTimeAsync(500));const p=state.saved.at(-1)!,expected=name==='Light'?'#e21b2e':'#ffff00';
   expect(p.style.labelColor).toBe(expected);
   const manifest=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8'));
   for(const s of p.slides.filter(s=>!fixedSlot(s))){
    expect(s.style.labelColor).toBe(expected);const labels=resolveSlide(p,s,manifest,2).elements.filter(e=>e.id==='question'||e.id.startsWith('option-'));expect(labels).toHaveLength(5);
    for(const e of labels)expect(e.runs!.find(r=>r.color)!.color).toBe(expected);
   }
  }
 }finally{await c.close();}
});

it.each([['Light','All slides'],['Dark','All slides'],['Light','Selected slide'],['Dark','Selected slide']])('keeps a %s thumbnail upload uncropped and isolated with %s selected',async(themeName,scopeName)=>{
 const project=state.project!,oldAsset={id:'old-image',name:'Existing.png',width:1200,height:800,data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1EAAAAASUVORK5CYII='};project.assets[oldAsset.id]=oldAsset;
 project.slides.splice(project.slides.length-1,0,{...blankSlide(5),name:'Home Work',kind:'original'});
 for(const s of project.slides){s.image=oldAsset.id;s.imagePlacement={x:20,y:30,w:400,h:300,fit:'contain',crop:{x:.1,y:.1,w:.8,h:.8}};}
 const c=await mount();try{
  await chooseSlide(c.host,'Thumbnail');await act(async()=>button(c.host,themeName).click());await act(async()=>button(c.host,scopeName).click());await act(async()=>vi.advanceTimersByTimeAsync(500));const before=structuredClone(state.saved.at(-1)!);
  const picture=()=>c.host.querySelector('.preview-frame [data-slide-image]') as HTMLElement;
  const others=(p:Project)=>p.slides.filter(s=>fixedSlot(s)!=='thumbnail');
  await uploadPicture(c.host);await act(async()=>vi.advanceTimersByTimeAsync(500));let after=state.saved.at(-1)!;
  expect(others(after)).toEqual(others(before));expect(after.slides[1].image).toBe('added-image');expect(after.slides[1].imagePlacement).toEqual({x:0,y:0,w:1920,h:1080,fit:'contain',crop:{x:0,y:0,w:1,h:1}});
  expect(picture().style.left).toBe('0px');expect(picture().style.top).toBe('0px');expect(picture().style.width).toBe('1920px');expect(picture().style.height).toBe('1080px');
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides).toEqual(before.slides);
  await uploadPicture(c.host);expect(button(c.host,'Crop image')).toBeUndefined();await act(async()=>vi.advanceTimersByTimeAsync(500));after=state.saved.at(-1)!;expect(others(after)).toEqual(others(before));
  await act(async()=>picture().click());await act(async()=>picture().dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true})));await act(async()=>vi.advanceTimersByTimeAsync(500));after=state.saved.at(-1)!;
  expect(after.slides[1].image).toBeUndefined();expect(others(after)).toEqual(others(before));
 }finally{await c.close();}
});
it('resets added text colour to black/white on theme clicks while preserving text and geometry across all slides',async()=>{
 const c=await mount();try{
  await act(async()=>button(c.host,'All slides').click());await act(async()=>button(c.host,'Add Text').click());await typeAddedText(c.host,'भारत / India');
  await act(async()=>(c.host.querySelector('.preview-frame [aria-label="Finish editing text"]') as HTMLButtonElement).click());
  const colour=c.host.querySelector('input[aria-label="Added text colour"]') as HTMLInputElement;
  expect(colour).not.toBeNull();
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(colour,'#ffff00');colour.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>vi.advanceTimersByTimeAsync(500));const before=structuredClone(state.saved.at(-1)!);
  expect(before.slides[2].textBoxes![0].color).toBe('#ffff00');
  for(const name of ['Light','Dark','Light']){
   await act(async()=>button(c.host,name).click());await act(async()=>vi.advanceTimersByTimeAsync(500));const p=state.saved.at(-1)!,expected=name==='Light'?'#000000':'#ffffff';
   for(const i of [2,3])expect(p.slides[i].textBoxes![0]).toEqual({...before.slides[i].textBoxes![0],color:''});
   const element=c.host.querySelector('.preview-frame [data-element^="text-box-"]') as HTMLElement;expect(element.style.color).toBe(name==='Light'?'rgb(0, 0, 0)':'rgb(255, 255, 255)');
   expect((c.host.querySelector('input[aria-label="Added text colour"]') as HTMLInputElement).value).toBe(expected);
  }
 }finally{await c.close();}
});

it('respects a locked thumbnail even when All slides is selected',async()=>{
 state.project!.slides[1].locked=true;const c=await mount();try{
  await chooseSlide(c.host,'Thumbnail');await act(async()=>button(c.host,'All slides').click());expect(c.host.querySelector('input[aria-label="Add Image"]')).toHaveProperty('disabled',true);
 }finally{await c.close();}
});

it('adds multiple images together and edits the selected layer without changing other images or text boxes',async()=>{
 const c=await mount();try{
  const input=c.host.querySelector('input[aria-label="Add Image"]') as HTMLInputElement;expect(input.multiple).toBe(true);
  await act(async()=>{Object.defineProperty(input,'files',{configurable:true,value:[new File(['one'],'One.png',{type:'image/png'}),new File(['two'],'Two.png',{type:'image/png'})]});input.dispatchEvent(new Event('change',{bubbles:true}));});await act(async()=>vi.advanceTimersByTimeAsync(500));
  const before=structuredClone(state.saved.at(-1)!),layer=before.slides[2].images![0],image=()=>c.host.querySelector('.preview-frame [data-slide-image="'+layer.id+'"]') as HTMLElement;
  expect(c.host.querySelectorAll('.preview-frame [data-slide-image]')).toHaveLength(2);expect((c.host.querySelector('select[aria-label="Select image"]') as HTMLSelectElement).options).toHaveLength(2);
  await pointer(image(),'pointerdown',100,100);await pointer(image(),'pointerup',60,100);await act(async()=>vi.advanceTimersByTimeAsync(500));let after=state.saved.at(-1)!;
  expect(after.slides[2].imagePlacement).toEqual(before.slides[2].imagePlacement);expect(after.slides[2].images![0].placement.x).toBe(layer.placement.x-100);expect(after.slides[3]).toEqual(before.slides[3]);
  await act(async()=>button(c.host,'Crop image').click());const stage=c.host.querySelector('.crop-stage') as HTMLElement;stage.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:600,bottom:400,width:600,height:400,toJSON(){}} as DOMRect);
  await pointer(stage.querySelector('[aria-label="Crop corner se"]') as HTMLElement,'pointerdown',600,400);await pointer(stage,'pointerup',300,200);await act(async()=>button(c.host,'Apply crop').click());await act(async()=>vi.advanceTimersByTimeAsync(500));after=state.saved.at(-1)!;
  expect(after.slides[2].images![0].placement.crop).toEqual({x:0,y:0,w:.5,h:.5});expect(after.slides[2].imagePlacement).toEqual(before.slides[2].imagePlacement);
  await act(async()=>image().click());await act(async()=>image().dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));expect(c.host.querySelectorAll('.preview-frame [data-slide-image]')).toHaveLength(1);
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());expect(c.host.querySelectorAll('.preview-frame [data-slide-image]')).toHaveLength(2);
  for(const text of ['पहला / First','दूसरा / Second']){await act(async()=>button(c.host,'Add Text').click());await typeAddedText(c.host,text);await act(async()=>(c.host.querySelector('.preview-frame [aria-label="Finish editing text"]') as HTMLButtonElement).click());}
  expect(c.host.querySelectorAll('.preview-frame [data-text-box]')).toHaveLength(2);await act(async()=>vi.advanceTimersByTimeAsync(500));const boxes=state.saved.at(-1)!.slides[2].textBoxes!;
  await act(async()=>(c.host.querySelector('.preview-frame [data-text-box="'+boxes[0].id+'"]') as HTMLElement).click());await typeAddedText(c.host,'बदला हुआ / Edited');await act(async()=>vi.advanceTimersByTimeAsync(500));after=state.saved.at(-1)!;
  expect(after.slides[2].textBoxes![0].text).toBe('बदला हुआ / Edited');expect(after.slides[2].textBoxes![1].text).toBe('दूसरा / Second');expect(after.slides[2].images![0].placement.crop).toEqual({x:0,y:0,w:.5,h:.5});
 }finally{await c.close();}
});
it('edits Hindi/English questions, options and headers on a single click and navigates with the large dashboard buttons',async()=>{
 state.project!.theme.headerText='Class header';const c=await mount();try{
  for(const [id,text] of [['question','Q.1 संशोधित प्रश्न / Edited question?'],['option-0','A) नया विकल्प / New option'],['heading','नई कक्षा / New class']]){
   const el=c.host.querySelector('.preview-frame [data-element="'+id+'"]') as HTMLElement;
   await act(async()=>el.click());expect(el.getAttribute('contenteditable')).toBe('true');
   await act(async()=>{el.textContent=text;el.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));});
   await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides[2].edits[id]).toBe(text);
  }
  const nav=c.host.querySelector('nav[aria-label="Slide navigation"]')!;expect(nav.textContent).toContain('3 / 5');expect(nav.querySelector('svg')?.getAttribute('width')).toBe('32');
  await act(async()=>(nav.querySelector('[aria-label="Previous slide"]') as HTMLButtonElement).click());expect(c.host.querySelector('.canvas-toolbar h2')?.textContent).toBe('Thumbnail');expect(nav.textContent).toContain('2 / 5');
  await act(async()=>(nav.querySelector('[aria-label="Next slide"]') as HTMLButtonElement).click());expect(c.host.querySelector('.preview-frame [data-element="question"]')?.textContent).toContain('संशोधित प्रश्न / Edited question?');
 }finally{await c.close();}
});

it('changes selected image/text stacking without selection changing the order, and restores it with Undo/Redo',async()=>{
 const c=await mount();try{
  await uploadPicture(c.host);await act(async()=>button(c.host,'Add Text').click());await typeAddedText(c.host,'ऊपर / Front');await act(async()=>(c.host.querySelector('.preview-frame [aria-label="Finish editing text"]') as HTMLButtonElement).click());await uploadPicture(c.host);await act(async()=>vi.advanceTimersByTimeAsync(500));
  const before=structuredClone(state.saved.at(-1)!),boxId='text-box-'+before.slides[2].textBoxes![0].id;
  const domOrder=()=>[...c.host.querySelector('.preview-frame .slide-canvas')!.children].map(n=>n.getAttribute('data-slide-image')||(n.hasAttribute('data-text-box')?'text-box-'+n.getAttribute('data-text-box'):n.getAttribute('data-element'))).filter(Boolean);
  const primary=c.host.querySelector('.preview-frame [data-slide-image="content-image"]') as HTMLElement,order=domOrder();await act(async()=>primary.click());expect(primary.style.zIndex).toBe('');expect(domOrder()).toEqual(order);
  await act(async()=>button(c.host,'Bring to Front').click());expect(domOrder().at(-1)).toBe('content-image');
  await act(async()=>button(c.host,'Send to Back').click());expect(domOrder()[0]).toBe('content-image');await act(async()=>vi.advanceTimersByTimeAsync(500));const back=structuredClone(state.saved.at(-1)!);expect(back.slides[2].layerOrder?.[0]).toBe('content-image');expect(back.slides[3]).toEqual(before.slides[3]);
  const {layerOrder,...unchanged}=back.slides[2];expect(unchanged).toEqual(before.slides[2]);
  await act(async()=>(c.host.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click());expect(domOrder().at(-1)).toBe('content-image');
  await act(async()=>(c.host.querySelector('[aria-label="Redo"]') as HTMLButtonElement).click());expect(domOrder()[0]).toBe('content-image');
  const select=c.host.querySelector('select[aria-label="Select image or text"]') as HTMLSelectElement;
  await act(async()=>{select.value=boxId;select.dispatchEvent(new Event('change',{bubbles:true}));});await act(async()=>button(c.host,'Send to Back').click());expect(domOrder()[0]).toBe(boxId);
  await act(async()=>button(c.host,'Bring to Front').click());expect(domOrder().at(-1)).toBe(boxId);
  await act(async()=>{select.value='question';select.dispatchEvent(new Event('change',{bubbles:true}));});await act(async()=>button(c.host,'Bring to Front').click());expect(domOrder().at(-1)).toBe('question');
 }finally{await c.close();}
});
it('uses All slides for linked layer order, preserves fixed slides and disables order controls for locked selections',async()=>{
 const c=await mount();try{
  await act(async()=>button(c.host,'All slides').click());await uploadPicture(c.host);await act(async()=>button(c.host,'Add Text').click());await typeAddedText(c.host,'Shared note');await act(async()=>(c.host.querySelector('.preview-frame [aria-label="Finish editing text"]') as HTMLButtonElement).click());await act(async()=>vi.advanceTimersByTimeAsync(500));
  const before=structuredClone(state.saved.at(-1)!),pic=c.host.querySelector('.preview-frame [data-slide-image="content-image"]') as HTMLElement;await act(async()=>pic.click());await act(async()=>button(c.host,'Send to Back').click());await act(async()=>vi.advanceTimersByTimeAsync(500));const after=state.saved.at(-1)!;
  expect(after.slides[2].layerOrder?.[0]).toBe('content-image');expect(after.slides[3].layerOrder?.[0]).toBe('content-image');expect(after.slides.filter(s=>fixedSlot(s))).toEqual(before.slides.filter(s=>fixedSlot(s)));
  await act(async()=>button(c.host,'Text').click());const lock=[...c.host.querySelectorAll('label')].find(e=>e.textContent?.includes('Lock “content-image”'))!.querySelector('input')!;await act(async()=>lock.click());
  expect(button(c.host,'Bring to Front').disabled).toBe(true);expect(button(c.host,'Send to Back').disabled).toBe(true);
 }finally{await c.close();}
});

it('offers Aptos Bold for slide text and Add Text, retains weight 700 and saves the chosen family',async()=>{
 const c=await mount();try{
  await act(async()=>button(c.host,'Text').click());
  await act(async()=>[...c.host.querySelectorAll('summary')].find(e=>e.textContent==='Typography')!.click());
  const family=c.host.querySelector('[aria-label="Font family"]') as HTMLSelectElement;
  expect([...family.options].find(o=>o.value==='Aptos')?.text).toBe('Aptos Bold');
  await act(async()=>{family.value='Aptos';family.dispatchEvent(new Event('change',{bubbles:true}));});
  const question=c.host.querySelector('.preview-frame [data-element="question"]') as HTMLElement;
  expect(question.style.fontFamily).toContain('Aptos');expect(question.style.fontWeight).toBe('700');
  await act(async()=>button(c.host,'Layout').click());
  await act(async()=>button(c.host,'Add Text').click());
  const added=c.host.querySelector('[aria-label="Added text font"]') as HTMLSelectElement;
  expect(added.value).toBe('Aptos');expect([...added.options].find(o=>o.value==='Aptos')?.text).toBe('Aptos Bold');
  expect((c.host.querySelector('[aria-label="Added text bold"]') as HTMLButtonElement).disabled).toBe(true);
  await act(async()=>vi.advanceTimersByTimeAsync(500));
  const saved=state.saved.at(-1)!;expect(saved.slides[2].style).toMatchObject({font:'Aptos',bold:true});
  expect(saved.slides[2].textBoxes![0]).toMatchObject({font:'Aptos',bold:true});
 }finally{await c.close();}
});

it('applies separate Hindi/English fonts using the selected/all scope and keeps the font uploader compact',async()=>{
 const c=await mount();try{
  await act(async()=>button(c.host,'Text').click());await act(async()=>[...c.host.querySelectorAll('summary')].find(e=>e.textContent==='Typography')!.click());
  const choose=async(label:string,value:string)=>{await act(async()=>{const select=c.host.querySelector('[aria-label="'+label+'"]') as HTMLSelectElement;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});};
  await choose('Hindi font','Mangal');await choose('English font','Aptos');
  const runs=[...c.host.querySelectorAll('.preview-frame [data-element="question"]>span')] as HTMLElement[];
  expect(runs.find(e=>e.textContent?.includes('भारत'))?.style.fontFamily).toContain('Mangal');
  expect(runs.find(e=>e.textContent?.includes('Capital'))?.style.fontFamily).toContain('Aptos');
  await act(async()=>vi.advanceTimersByTimeAsync(500));let saved=state.saved.at(-1)!;
  expect(saved.slides[2].style).toMatchObject({hindiFont:'Mangal',englishFont:'Aptos'});expect(saved.slides[3].style.hindiFont).toBeUndefined();
  await act(async()=>button(c.host,'All slides').click());await choose('Hindi font','Kokila');await choose('English font','Aptos');
  expect(c.host.querySelector('.font-select-row [aria-label="Font family"]')).not.toBeNull();
  expect(c.host.querySelector('.font-select-row .font-upload-inline input[type="file"]')).not.toBeNull();
  expect(c.host.querySelector('.typography-controls .font-status')).toBeNull();
  await act(async()=>vi.advanceTimersByTimeAsync(500));saved=state.saved.at(-1)!;
  expect(saved.style).toMatchObject({hindiFont:'Kokila',englishFont:'Aptos'});
  expect(saved.slides.every(s=>s.style.hindiFont==='Kokila'&&s.style.englishFont==='Aptos')).toBe(true);
  await act(async()=>button(c.host,'Layout').click());await act(async()=>button(c.host,'Add Text').click());
  const hi=c.host.querySelector('[aria-label="Added text Hindi font"]') as HTMLSelectElement,en=c.host.querySelector('[aria-label="Added text English font"]') as HTMLSelectElement;
  expect(hi.value).toBe('Kokila');expect(en.value).toBe('Aptos');
 }finally{await c.close();}
});
it('uses arrangement buttons with per-slide adaptive fitting and selected/all scope',async()=>{
 const p=state.project!;p.slides[2].text='Q.1 Capital?\nA. Delhi\nB. Mumbai\nC. Jaipur\nD. Agra';
 p.slides[3].text='Q.2 Explanation?\nA. This is a long option with enough detailed information to wrap across multiple lines inside half of the teaching area.\nB. Short\nC. Short\nD. Short';
 const source=p.slides.map(s=>s.text);const c=await mount();try{
  await act(async()=>button(c.host,'All slides').click());
  await act(async()=>[...c.host.querySelectorAll('summary')].find(e=>e.textContent==='Teaching layout')!.click());
  const group=c.host.querySelector('[role="group"][aria-label="Option arrangement"]') as HTMLElement;
  expect([...group.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['Adaptive','Vertical','Two columns']);
  expect(group.closest('.field')!.querySelector('select')).toBeNull();expect(group.querySelector('[aria-pressed="true"]')).toBeNull();
  const choose=async(label:string)=>{await act(async()=>button(group,label).click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(button(group,label).getAttribute('aria-pressed')).toBe('true');expect(group.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);};
  await choose('Adaptive');let saved=state.saved.at(-1)!;
  expect(saved.slides.every(s=>s.optionsMode==='adaptive')).toBe(true);
  const manifest=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8'));
  const optionElements=(i:number)=>resolveSlide(saved,saved.slides[i],manifest,i).elements.filter(e=>e.id.startsWith('option-'));
  let short=optionElements(2);const long=optionElements(3);
  expect(short[0].y).toBe(short[1].y);expect(long[0].x).toBe(long[1].x);expect(long[1].y).toBeGreaterThan(long[0].y);
  await act(async()=>button(c.host,'Selected slide').click());await choose('Vertical');saved=state.saved.at(-1)!;
  expect(saved.slides[2].optionsMode).toBe('vertical');expect(saved.slides[3].optionsMode).toBe('adaptive');
  short=optionElements(2);expect(short[0].x).toBe(short[1].x);expect(short[1].y).toBeGreaterThan(short[0].y);
  await choose('Two columns');saved=state.saved.at(-1)!;expect(saved.slides[2].optionsMode).toBe('columns');expect(saved.slides[3].optionsMode).toBe('adaptive');
  short=optionElements(2);expect(short[0].y).toBe(short[1].y);expect(short[1].x).toBeGreaterThan(short[0].x);expect(saved.slides.map(s=>s.text)).toEqual(source);
 }finally{await c.close();}
});

it('uses reserve buttons with selected/all scope and retains the width when reserve is removed',async()=>{
 const c=await mount();try{
  await act(async()=>[...c.host.querySelectorAll('summary')].find(e=>e.textContent==='Teaching space')!.click());
  const group=c.host.querySelector('[role="group"][aria-label="Teacher / webcam reserve"]') as HTMLElement;
  expect([...group.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['No reserve','Left','Right']);expect(group.closest('.field')!.querySelector('select')).toBeNull();
  const width=()=>[...group.closest('details')!.querySelectorAll('label.field')].find(e=>e.textContent?.startsWith('Reserve width'));
  expect(button(group,'No reserve').getAttribute('aria-pressed')).toBe('true');expect(width()).toBeUndefined();
  const choose=async(label:string)=>{await act(async()=>button(group,label).click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(button(group,label).getAttribute('aria-pressed')).toBe('true');expect(group.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);};
  await choose('Left');let saved=state.saved.at(-1)!;expect(saved.slides[2].reserve).toBe('left');expect(saved.slides[3].reserve).toBe('none');expect(width()).toBeDefined();
  const beforeWidth=saved.slides[2].reserveWidth;const manifest=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8'));
  const left=resolveSlide(saved,saved.slides[2],manifest,2).elements.find(e=>e.id==='question')!;
  await act(async()=>button(c.host,'All slides').click());await choose('Right');saved=state.saved.at(-1)!;expect(saved.slides.every(s=>s.reserve==='right')).toBe(true);
  const right=resolveSlide(saved,saved.slides[2],manifest,2).elements.find(e=>e.id==='question')!;expect(right.x).toBeLessThan(left.x);expect(right.w).toBe(left.w);
  await act(async()=>button(c.host,'Selected slide').click());await choose('No reserve');saved=state.saved.at(-1)!;expect(saved.slides[2].reserve).toBe('none');expect(saved.slides[3].reserve).toBe('right');expect(saved.slides[2].reserveWidth).toBe(beforeWidth);expect(width()).toBeUndefined();
 }finally{await c.close();}
});

it('sets independent question colours using selected/all scope without recolouring options or labels',async()=>{
 state.project!.style={...state.project!.style,hindiFont:'Mangal',englishFont:'Aptos'};
 const c=await mount();try{
  const optionsBefore=[...c.host.querySelectorAll('.preview-frame [data-element^="option-"]')].map(e=>e.outerHTML);
  await act(async()=>button(c.host,'Text').click());await act(async()=>[...c.host.querySelectorAll('summary')].find(e=>e.textContent==='Typography')!.click());
  const colour=async(label:string,value:string)=>{await act(async()=>{const input=c.host.querySelector('[aria-label="'+label+'"]') as HTMLInputElement;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});};
  const questionRuns=()=>[...c.host.querySelectorAll('.preview-frame [data-element="question"]>span')] as HTMLElement[];
  await colour('Hindi question colour','#00e6cc');await colour('English question colour','#ffb347');
  expect(questionRuns().find(r=>r.textContent?.includes('भारत'))?.style.color).toBe('rgb(0, 230, 204)');
  expect(questionRuns().find(r=>r.textContent?.includes('Capital'))?.style.color).toBe('rgb(255, 179, 71)');
  expect(questionRuns().find(r=>r.textContent==='Q.1')?.style.color).toBe('rgb(255, 255, 0)');
  expect([...c.host.querySelectorAll('.preview-frame [data-element^="option-"]')].map(e=>e.outerHTML)).toEqual(optionsBefore);
  await act(async()=>vi.advanceTimersByTimeAsync(500));let saved=state.saved.at(-1)!;
  expect(saved.slides[2].style).toMatchObject({questionHindiColor:'#00e6cc',questionEnglishColor:'#ffb347'});expect(saved.slides[3].style.questionHindiColor).toBeUndefined();
  await act(async()=>button(c.host,'All slides').click());await colour('Hindi question colour','#ff99cc');await colour('English question colour','#99ddff');
  await act(async()=>vi.advanceTimersByTimeAsync(500));saved=state.saved.at(-1)!;
  expect(saved.style).toMatchObject({questionHindiColor:'#ff99cc',questionEnglishColor:'#99ddff'});
  expect(saved.slides.every(s=>s.style.questionHindiColor==='#ff99cc'&&s.style.questionEnglishColor==='#99ddff')).toBe(true);
  const q=c.host.querySelector('.preview-frame [data-element="question"]') as HTMLElement;
  await act(async()=>q.click());expect(q.getAttribute('contenteditable')).toBe('true');
  expect(questionRuns().find(r=>r.textContent?.includes('भारत'))?.style.color).toBe('rgb(255, 153, 204)');
  await act(async()=>q.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));
  await act(async()=>(c.host.querySelector('[aria-label="Reset Hindi question colour"]') as HTMLButtonElement).click());
  expect(questionRuns().find(r=>r.textContent?.includes('भारत'))?.style.color).toBe('');
  expect(questionRuns().find(r=>r.textContent?.includes('Capital'))?.style.color).toBe('rgb(153, 221, 255)');
  expect([...c.host.querySelectorAll('.preview-frame [data-element^="option-"]')].map(e=>e.outerHTML)).toEqual(optionsBefore);
 }finally{await c.close();}
});
it('shows question colour controls for MCQs and hides them on theory slides',async()=>{
 state.project!.slides[3]={...state.project!.slides[3],layout:'theory',theory:{title:'भारत / India'},text:'नागरिक / Citizens'};
 const c=await mount();try{
  await act(async()=>button(c.host,'Text').click());await act(async()=>[...c.host.querySelectorAll('summary')].find(e=>e.textContent==='Typography')!.click());
  expect(c.host.querySelector('[aria-label="Hindi question colour"]')).not.toBeNull();
  await chooseSlide(c.host,'Second question');
  expect(c.host.querySelector('[aria-label="Hindi question colour"]')).toBeNull();expect(c.host.querySelector('[aria-label="English question colour"]')).toBeNull();
 }finally{await c.close();}
});

it('switches bilingual question and option order from Layout using selected/all scope while preserving answer and source',async()=>{
 state.project!.slides[2].correctOption=0;state.project!.slides[2].answerReveal=true;
 const source=state.project!.slides.map(s=>s.text);
 const c=await mount();try{
  const section=(title:string)=>[...c.host.querySelectorAll('summary')].find(e=>e.textContent===title)!;
  const question=()=>c.host.querySelector('.preview-frame [data-element="question"]') as HTMLElement;
  const options=()=>[...c.host.querySelectorAll('.preview-frame [data-element^="option-"]')].map(e=>e.textContent);
  const originalOptions=options();
  await act(async()=>section('Teaching layout').click());
  await act(async()=>section('Language order').click());
  expect(section('Teaching layout').closest('details')!.open).toBe(false);
  expect(section('Language order').closest('details')!.open).toBe(true);
  const group=c.host.querySelector('[role="group"][aria-label="Language order"]') as HTMLElement;
  expect([...group.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['Hindi first','English first']);expect(group.closest('details')!.querySelector('select')).toBeNull();expect(group.querySelector('[aria-pressed="true"]')).toBeNull();
  const choose=async(value:string)=>{const target=button(group,value==='en-first'?'English first':'Hindi first');await act(async()=>target.click());await act(async()=>vi.advanceTimersByTimeAsync(500));expect(target.getAttribute('aria-pressed')).toBe('true');expect(group.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);};
  await choose('en-first');
  expect(question().textContent).toBe('Q.1 Capital of India?\nभारत की राजधानी');
  expect(options()).toEqual(['A) New Delhi / नई दिल्ली','B) Mumbai']);
  let saved=state.saved.at(-1)!;
  expect(saved.slides[2].style.questionLanguageOrder).toBe('en-first');
  expect(saved.slides[3].style.questionLanguageOrder).toBeUndefined();
  expect(saved.slides[2]).toMatchObject({correctOption:0,answerReveal:true});
  expect(saved.slides.map(s=>s.text)).toEqual(source);
  await act(async()=>button(c.host,'All slides').click());await choose('hi-first');
  saved=state.saved.at(-1)!;
  expect(saved.style.questionLanguageOrder).toBe('hi-first');
  expect(saved.slides.every(s=>s.style.questionLanguageOrder==='hi-first')).toBe(true);
  expect(question().textContent).toBe('Q.1 भारत की राजधानी\nCapital of India?');
  await chooseSlide(c.host,'Second question');expect(question().textContent).toBe('Q.2 भारत की राजधानी\nCapital of India?');
  await choose('en-first');expect(question().textContent).toBe('Q.2 Capital of India?\nभारत की राजधानी');
  const q=question();await act(async()=>q.click());expect(q.getAttribute('contenteditable')).toBe('true');
  expect(q.textContent).toBe('Q.2 Capital of India?\nभारत की राजधानी');
  await act(async()=>q.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));
  await choose('hi-first');expect(question().textContent).toBe('Q.2 भारत की राजधानी\nCapital of India?');
  expect(options()).toEqual(originalOptions);expect(state.saved.at(-1)!.slides.map(s=>s.text)).toEqual(source);
 }finally{await c.close();}
});

it('switches theory headings and bullets using selected/all Language order without rewriting source',async()=>{
 for(const s of state.project!.slides.filter(s=>s.layout==='mcq')){s.layout='theory';s.theory={title:'संविधान\nConstitution'};s.text='संविधान सर्वोच्च कानून है।\nThe Constitution is the supreme law.';s.style.bullets=true;}
 const before=structuredClone(state.project!);const c=await mount();try{
  await act(async()=>[...c.host.querySelectorAll('summary')].find(e=>e.textContent==='Language order')!.click());
  const group=c.host.querySelector('[role="group"][aria-label="Language order"]') as HTMLElement;
  const choose=async(label:string)=>{const b=button(group,label);expect(b.disabled).toBe(false);await act(async()=>b.click());await act(async()=>vi.advanceTimersByTimeAsync(500));};
  const check=(english:boolean)=>{for(const id of ['theory-title','theory-item-0']){const hi=c.host.querySelector('.preview-frame [data-element="'+id+'"]') as HTMLElement,en=c.host.querySelector('.preview-frame [data-element="'+id+'-en"]') as HTMLElement;expect(parseFloat(en.style.top)<parseFloat(hi.style.top)).toBe(english);}};
  await choose('English first');check(true);expect(state.saved.at(-1)!.slides[3].style.questionLanguageOrder).toBeUndefined();
  await chooseSlide(c.host,'Second question');check(false);await act(async()=>button(c.host,'All slides').click());await choose('English first');check(true);
  await chooseSlide(c.host,'First question');check(true);await act(async()=>button(c.host,'Selected slide').click());await choose('Hindi first');check(false);
  expect(state.saved.at(-1)!.slides[3].style.questionLanguageOrder).toBe('en-first');expect(state.saved.at(-1)!.slides.map(s=>[s.text,s.theory])).toEqual(before.slides.map(s=>[s.text,s.theory]));
 }finally{await c.close();}
});
