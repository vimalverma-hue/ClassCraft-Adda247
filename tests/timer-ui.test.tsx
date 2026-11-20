// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AnalogTimer} from '../src/AnalogTimer';
import {SlideCanvas} from '../src/SlideCanvas';
import type {ResolvedSlide} from '../src/model';
it('counts down from 60 in large plain seconds through 59, 58 and zero',async()=>{
 vi.useFakeTimers();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div'),root=createRoot(host);
 try{
  await act(async()=>root.render(<AnalogTimer timer={{seconds:60,x:0,y:0,size:200}} started/>));
  expect(host.textContent).toBe('60');expect(host.querySelector('text')!.getAttribute('font-size')).toBe('84');
  await act(async()=>vi.advanceTimersByTime(1000));expect(host.textContent).toBe('59');
  await act(async()=>vi.advanceTimersByTime(1000));expect(host.textContent).toBe('58');
  await act(async()=>vi.advanceTimersByTime(49000));expect(host.textContent).toBe('9');
  await act(async()=>vi.advanceTimersByTime(9000));expect(host.textContent).toBe('0');
  expect(host.querySelector('[data-timer-progress]')!.getAttribute('data-timer-progress')).toBe('1');
 }finally{await act(async()=>root.unmount());vi.useRealTimers();delete(globalThis as any).IS_REACT_ACT_ENVIRONMENT;}
});
it('shows bold centred seconds and continuously fills the red ring with elapsed time',async()=>{vi.useFakeTimers();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');const root=createRoot(host);try{await act(async()=>root.render(<AnalogTimer timer={{seconds:30,x:0,y:0,size:200}} interactive/>));const clock=host.querySelector('svg')!;expect(host.textContent).toBe('30');expect(host.querySelector('text')!.getAttribute('font-size')).toBe('84');expect(host.querySelector('text')!.getAttribute('fill')).toBe('#ffff00');expect(host.querySelector('text')!.getAttribute('font-family')).toContain('Impact');expect(host.querySelector('text')!.getAttribute('font-weight')).toBe('400');await act(async()=>clock.dispatchEvent(new MouseEvent('click',{bubbles:true})));await act(async()=>vi.advanceTimersByTime(10000));expect(host.textContent).toBe('20');expect(Number(host.querySelector('[data-timer-progress]')!.getAttribute('data-timer-progress'))).toBeCloseTo(1/3);await act(async()=>vi.advanceTimersByTime(500));expect(host.textContent).toBe('20');expect(Number(host.querySelector('[data-timer-progress]')!.getAttribute('data-timer-progress'))).toBeCloseTo(.35);await act(async()=>vi.advanceTimersByTime(19500));expect(host.textContent).toBe('0');expect(host.querySelector('[data-timer-progress]')!.getAttribute('data-timer-progress')).toBe('1');expect(host.querySelector('button')).toBeNull();expect(host.querySelector('[data-timer-hand]')).toBeNull();}finally{await act(async()=>root.unmount());vi.useRealTimers();delete(globalThis as any).IS_REACT_ACT_ENVIRONMENT;}});
it.each([120,180] as const)('keeps minute:second formatting for %s-second timers even below ten seconds',async seconds=>{vi.useFakeTimers();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');const root=createRoot(host);try{await act(async()=>root.render(<AnalogTimer timer={{seconds,x:0,y:0,size:200}} started/>));expect(host.textContent).toBe('0'+seconds/60+':00');await act(async()=>vi.advanceTimersByTime((seconds-9)*1000));expect(host.textContent).toBe('00:09');expect(host.querySelector('text')!.getAttribute('font-size')).toBe('52');await act(async()=>vi.advanceTimersByTime(9000));expect(host.textContent).toBe('00:00');}finally{await act(async()=>root.unmount());vi.useRealTimers();delete(globalThis as any).IS_REACT_ACT_ENVIRONMENT;}});
it('freezes the visible number and fractional ring on answer reveal, then resets on another slide',async()=>{
 vi.useFakeTimers();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div'),root=createRoot(host);
 function Harness(){const[step,setStep]=useState(0);const slide:ResolvedSlide={id:'q1',name:'Question',notes:'',warnings:[],background:'#191b1c',elements:[{id:'analog-timer',kind:'timer',x:0,y:0,w:200,h:200,timer:{seconds:30,x:0,y:0,size:200}},...(step>1?[{id:'answer-reveal',kind:'text' as const,text:'Answer B',x:220,y:0,w:200,h:100}]:[])]};return <div onClick={()=>setStep(n=>n+1)}><SlideCanvas slide={slide} timerStarted={step>0}/></div>;}
 try{
  await act(async()=>root.render(<Harness/>));
  await act(async()=>host.querySelector('svg')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await act(async()=>vi.advanceTimersByTime(2275));expect(host.textContent).toBe('28');
  await act(async()=>host.querySelector('svg')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));expect(host.textContent).toBe('28Answer B');
  const frozen=host.querySelector('[data-timer-progress]')!.getAttribute('data-timer-progress');
  expect(Number(frozen)).toBeCloseTo(2.275/30);
  const marker=host.querySelector('[data-timer-marker]')!.outerHTML;
  await act(async()=>vi.advanceTimersByTime(40000));
  expect(host.textContent).toBe('28Answer B');expect(host.querySelector('[data-timer-progress]')!.getAttribute('data-timer-progress')).toBe(frozen);expect(host.querySelector('[data-timer-marker]')!.outerHTML).toBe(marker);
  await act(async()=>root.render(<Harness key="next"/>));expect(host.textContent).toBe('30');expect(host.querySelector('[data-timer-progress]')!.getAttribute('data-timer-progress')).toBe('0');
 }finally{await act(async()=>root.unmount());vi.useRealTimers();delete(globalThis as any).IS_REACT_ACT_ENVIRONMENT;}
});
