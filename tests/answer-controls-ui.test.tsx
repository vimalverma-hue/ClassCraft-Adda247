// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AnswerControls,HeaderControls} from '../src/TeachingControls';
import {SettingsAccordion} from '../src/SettingsSection';
import {blankSlide,newProject,defaultTheme,type Slide} from '../src/model';

const title='Add Answer';
const heading=(host:HTMLElement)=>[...host.querySelectorAll('summary')].find(s=>s.textContent===title)! as HTMLElement;
const answer=(host:HTMLElement)=>host.querySelector('[aria-label="Correct answer"]') as HTMLSelectElement;
const preview=(host:HTMLElement)=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Preview answer highlight')!;

it('keeps answer settings visible and openable on original, theory and empty MCQ slides',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div'),root=createRoot(host);
 const slides:Slide[]=[...newProject().slides,{...blankSlide(),layout:'theory'},{...blankSlide(),layout:'mcq'}];
 try{
  for(const slide of slides){
   await act(async()=>root.render(<SettingsAccordion><AnswerControls slide={slide} onChange={()=>{}} revealed={false} onPreview={()=>{}}/></SettingsAccordion>));
   expect(heading(host)).toBeDefined();
   if(!host.querySelector('details')!.open)await act(async()=>heading(host).click());
   expect(host.querySelector('details')!.open).toBe(true);
   expect(answer(host).disabled).toBe(true);expect(preview(host).disabled).toBe(true);
   expect(answer(host).textContent).toBe(slide.layout==='mcq'?'No options found':'Select an MCQ slide');
  }
 }finally{await act(async()=>root.unmount());delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;}
});

it('enables marking and preview on MCQs and retains the choice when changing slides or accordion groups',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div'),root=createRoot(host),onPreview=vi.fn();
 function Harness(){
  const [mcq,setMcq]=useState<Slide>({...blankSlide(),layout:'mcq',text:'Q.1 राजधानी / Capital?\nA. मुंबई / Mumbai\nB. दिल्ली / Delhi'}),[theory,setTheory]=useState(false);
  const current=theory?{...blankSlide(),layout:'theory' as const,correctOption:1,answerReveal:true}:mcq;
  return <><button onClick={()=>setTheory(!theory)}>Switch slide</button><SettingsAccordion><HeaderControls theme={defaultTheme} onChange={()=>{}}/><AnswerControls slide={current} onChange={change=>setMcq(old=>({...old,...change}))} revealed={false} onPreview={onPreview}/></SettingsAccordion></>;
 }
 try{
  await act(async()=>root.render(<Harness/>));await act(async()=>heading(host).click());
  expect(answer(host).disabled).toBe(false);expect(preview(host).disabled).toBe(true);
  await act(async()=>{answer(host).value='1';answer(host).dispatchEvent(new Event('change',{bubbles:true}));});
  expect(preview(host).disabled).toBe(false);await act(async()=>preview(host).click());expect(onPreview).toHaveBeenCalledOnce();
  await act(async()=>host.querySelector('summary')!.click());expect(host.querySelectorAll('details[open]')).toHaveLength(1);
  await act(async()=>heading(host).click());expect(answer(host).value).toBe('1');expect(host.querySelectorAll('details[open]')).toHaveLength(1);
  await act(async()=>host.querySelector('button')!.click());expect(heading(host)).toBeDefined();expect(answer(host).disabled).toBe(true);expect(preview(host).disabled).toBe(true);
  const reveal=host.querySelector('[aria-label="Reveal answer on click"]') as HTMLInputElement;expect(reveal.disabled).toBe(true);expect(reveal.checked).toBe(false);
  await act(async()=>host.querySelector('button')!.click());expect(answer(host).value).toBe('1');expect(preview(host).disabled).toBe(false);expect(reveal.checked).toBe(true);
 }finally{await act(async()=>root.unmount());delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;}
});
