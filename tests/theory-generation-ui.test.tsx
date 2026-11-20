// @vitest-environment jsdom
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import fs from 'node:fs';
import {newProject,blankSlide,type Project} from '../src/model';
import {ensureClassSlides} from '../src/classSlides';
import App from '../src/App';

const state=vi.hoisted(()=>({project:null as Project|null,saved:[] as Project[],failBackup:false}));
vi.mock('../src/storage',async importOriginal=>({...await importOriginal<typeof import('../src/storage')>(),restoreProject:async()=>structuredClone(state.project),listProjects:async()=>[structuredClone(state.project)],saveProject:async(p:Project)=>{if(state.failBackup&&p.name.endsWith(' · before replacement'))throw Error('Backup storage unavailable');state.saved.push(structuredClone(p));},getStyleLibrary:async()=>({presets:[],defaultId:''})}));
vi.mock('../src/fonts',async importOriginal=>({...await importOriginal<typeof import('../src/fonts')>(),ensureFonts:async()=>{},registerProjectFonts:async()=>{}}));
vi.mock('../src/SlideCanvas',()=>({AutoSlide:({slide}:any)=><div>{slide.elements.map((e:any)=>e.text||'').join(' ')}</div>,SlideCanvas:()=>null}));
const button=(host:HTMLElement,text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===text)!;
beforeEach(()=>{
 vi.useFakeTimers();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();state.saved=[];state.failBackup=false;
 const p=newProject();p.name='Direct theory';p.source='# Constitution\n\nThe Constitution protects the rights of citizens.';p.refinementMode='modify';p.refinedContentHash='outdated';
 p.slides=[{...blankSlide(),name:'Manual lesson',text:'Old manual content.',manual:true},{...blankSlide(),name:'Locked notes',text:'Keep this locked content.',manual:true,locked:true}];state.project=ensureClassSlides(p);
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 const manifest=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8'));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json(url==='/templates/manifest.json'?manifest:{available:false,ai:false})));
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();delete(globalThis as any).IS_REACT_ACT_ENVIRONMENT;});
async function mount(mode:Project['contentMode'],chooseModify=false){
 state.project!.contentMode=mode;const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 await act(async()=>root.render(<App/>));
 if(chooseModify){const select=host.querySelector('[aria-label="Content treatment"]') as HTMLSelectElement;await act(async()=>{select.value='modify';select.dispatchEvent(new Event('change',{bubbles:true}));});}
 return{host,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}

it.each(['theory-bullets','theory-paragraphs'] as const)('creates %s in one click despite unreviewed refine mode and manual edits, retaining a backup and locked slides',async mode=>{
 const c=await mount(mode,true);try{
  await act(async()=>button(c.host,'Create Slides→').click());
  expect(c.host.querySelector('[role="dialog"]')).toBeNull();expect(c.host.querySelector('.error-toast')).toBeNull();
  expect(c.host.querySelector('.slides-panel')?.textContent).toContain('The Constitution protects');
  const backup=state.saved.find(p=>p.name.endsWith(' · before replacement'))!;
  expect(backup.slides.some(s=>s.text==='Old manual content.')).toBe(true);expect(backup.source).toBe(state.project!.source);
  await act(async()=>vi.advanceTimersByTimeAsync(500));
  const latest=state.saved.at(-1)!;expect(latest.id).toBe(state.project!.id);expect(latest.source).toBe(state.project!.source);expect(latest.refinementMode).toBe('modify');
  expect(latest.slides.filter(s=>s.layout==='theory'&&s.theory)).toHaveLength(1);expect(latest.slides.some(s=>s.locked&&s.text==='Keep this locked content.')).toBe(true);
  expect(latest.slides.some(s=>s.text==='Old manual content.')).toBe(false);
  await act(async()=>button(c.host,'Content').click());await act(async()=>button(c.host,'Refine & review content').click());
  expect(c.host.querySelector('[aria-label="Review refined content"]')).not.toBeNull();
  expect(vi.mocked(fetch).mock.calls.some(([url])=>url==='/api/refine')).toBe(false);
 }finally{await c.close();}
});

it.each([undefined,'all','mcq-only'] as const)('opens saved mode %s with three choices and a working MCQ default without replacing existing slides on load',async mode=>{
 state.project!.refinementMode='as-is';state.project!.source='Q.1 Capital of India?\nA) Mumbai\nB) New Delhi\nAnswer: B\nExplanation: Delhi is the national capital.';
 const c=await mount(mode);try{
  const choices=c.host.querySelector('[aria-label="Content to slides"]') as HTMLSelectElement;
  expect([...choices.options].map(o=>o.value)).toEqual(['mcq-only','theory-bullets','theory-paragraphs']);expect(choices.value).toBe('mcq-only');
  expect(c.host.querySelector('.right-heading')).toBeNull();
  await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides).toEqual(state.project!.slides);
  await act(async()=>button(c.host,'Create Slides→').click());
  expect(c.host.querySelector('.error-toast')).toBeNull();expect(c.host.querySelector('[role="dialog"]')).toBeNull();
  await act(async()=>vi.advanceTimersByTimeAsync(500));const latest=state.saved.at(-1)!;
  expect(latest.contentMode).toBe('mcq-only');expect(latest.slides.filter(s=>s.mcqOnly)).toHaveLength(1);
  expect(c.host.querySelector('.slides-panel')?.textContent).toContain('Capital of India?');expect(c.host.querySelector('.slides-panel')?.textContent).not.toContain('Delhi is the national capital.');
 }finally{await c.close();}
});

it.each(['content','layout'] as const)('generates MCQs directly from the %s button even with Modify selected and an unreviewed source',async entry=>{
 state.project!.source='Q.1 Capital of India?\nA) Mumbai\nB) New Delhi\n\nAnswer Key: 1-B';
 const c=await mount('mcq-only',true);try{
  if(entry==='layout'){
   const heading=[...c.host.querySelectorAll('summary')].find(s=>s.textContent==='Teaching layout')!;
   await act(async()=>heading.click());await act(async()=>[...c.host.querySelectorAll('button')].find(b=>b.textContent?.endsWith('One MCQ'))!.click());
  }else await act(async()=>button(c.host,'Create Slides→').click());
  expect(c.host.querySelector('[role="dialog"]')).toBeNull();expect(c.host.querySelector('.error-toast')).toBeNull();
  expect(c.host.querySelector('.slides-panel')?.textContent).toContain('Capital of India?');
  const backup=state.saved.find(p=>p.name.endsWith(' · before replacement'))!;expect(backup.slides.some(s=>s.text==='Old manual content.')).toBe(true);
  await act(async()=>vi.advanceTimersByTimeAsync(500));const latest=state.saved.at(-1)!;
  expect(latest.source).toBe(state.project!.source);expect(latest.refinementMode).toBe('modify');
  const mcqs=latest.slides.filter(s=>s.mcqOnly);expect(mcqs).toHaveLength(1);expect(mcqs[0].correctOption).toBe(1);expect(mcqs[0].answerReveal).toBe(true);
  expect(vi.mocked(fetch).mock.calls.some(([url])=>url==='/api/refine')).toBe(false);
  await act(async()=>button(c.host,'Content').click());await act(async()=>button(c.host,'Refine & review content').click());
  expect(c.host.querySelector('[aria-label="Review refined content"]')).not.toBeNull();
  await act(async()=>button(c.host,'Keep original').click());await act(async()=>button(c.host,'Create Slides→').click());
  expect(c.host.querySelector('[role="dialog"]')).toBeNull();expect(c.host.querySelector('.slides-panel')?.textContent).toContain('Capital of India?');
 }finally{await c.close();}
});

it('defaults to As it is on new, restored and reopened projects while allowing explicit refinement',async()=>{
 expect(newProject().refinementMode).toBe('as-is');const c=await mount('mcq-only');try{
  const treatment=()=>c.host.querySelector('[aria-label="Content treatment"]') as HTMLSelectElement;
  expect(treatment().value).toBe('as-is');expect(button(c.host,'Refine & review content')).toBeUndefined();
  await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.source).toBe(state.project!.source);expect(state.saved.at(-1)!.slides).toEqual(state.project!.slides);
  await act(async()=>{treatment().value='modify';treatment().dispatchEvent(new Event('change',{bubbles:true}));});
  expect(treatment().value).toBe('modify');expect(button(c.host,'Refine & review content')).toBeDefined();
  await act(async()=>(c.host.querySelector('[aria-label="Open projects"]') as HTMLButtonElement).click());
  await act(async()=>button(c.host,'Open').click());expect(treatment().value).toBe('as-is');expect(c.host.querySelector('[role="dialog"]')).toBeNull();
 }finally{await c.close();}
});

it('shows the matching language converter when Content to slides changes without a second content selector',async()=>{
 const c=await mount('mcq-only');try{
  expect(c.host.querySelector('[aria-label="Content to convert"]')).toBeNull();
  expect(c.host.querySelector('[aria-label="Question output language"]')).not.toBeNull();
  const mode=c.host.querySelector('[aria-label="Content to slides"]') as HTMLSelectElement;
  for(const value of ['theory-bullets','theory-paragraphs','mcq-only']){
   await act(async()=>{mode.value=value;mode.dispatchEvent(new Event('change',{bubbles:true}));});
   expect(c.host.querySelector('[aria-label="Theory output language"]')!==null).toBe(value!=='mcq-only');
   expect(c.host.querySelector('[aria-label="Question output language"]')!==null).toBe(value==='mcq-only');
   expect(c.host.querySelector('[role="dialog"]')).toBeNull();
  }
  expect((c.host.querySelector('[aria-label="Teaching content"]') as HTMLTextAreaElement).value).toBe(state.project!.source);
 }finally{await c.close();}
});

it.each(['theory-bullets','mcq-only'] as const)('keeps the current slides when the %s backup cannot be saved',async mode=>{
 if(mode==='mcq-only')state.project!.source='Q.1 Capital?\nA) Mumbai\nB) Delhi\nAnswer: B';
 const c=await mount(mode);try{
  state.failBackup=true;await act(async()=>button(c.host,'Create Slides→').click());
  expect(c.host.querySelector('.error-toast')?.textContent).toContain('Backup storage unavailable');
  expect(c.host.querySelector('[role="dialog"]')).toBeNull();
  await act(async()=>vi.advanceTimersByTimeAsync(500));expect(state.saved.at(-1)!.slides.some(s=>s.text==='Old manual content.')).toBe(true);
 }finally{await c.close();}
});
