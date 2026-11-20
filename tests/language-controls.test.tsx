// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import fs from 'node:fs';
import {LanguageControls} from '../src/LanguageControls';
import {newProject,type Project,type TemplateSet} from '../src/model';
import {prepareLanguageProject} from '../src/languages';

it('reviews bilingual content, cancels without applying, then applies only English through the real controls',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const canvas=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
 const base=newProject();base.source='Q.4 राजधानी? / Capital?\nA) मुंबई / Mumbai\nB) दिल्ली / Delhi\nAnswer: B';const p=prepareLanguageProject(base,templates,'source');
 const onApply=vi.fn(async(_p:Project,_count:number)=>{}),host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<LanguageControls project={p} templates={templates} onApply={onApply}/>));
  const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label)!;
  const select=host.querySelector('[aria-label="Question output language"]') as HTMLSelectElement;
  expect([...select.options].map(o=>o.value)).toEqual(['both','hi','en']);
  expect(host.querySelector('[aria-label="Questions to convert"]')).toBeNull();
  await act(async()=>button('Convert & review all MCQs').click());
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();expect((host.querySelector('[aria-label="Question 1 A) en"]') as HTMLTextAreaElement).value).toBe('Mumbai');
  await act(async()=>button('Cancel').click());expect(onApply).not.toHaveBeenCalled();expect(host.querySelector('[role="dialog"]')).toBeNull();
  await act(async()=>{select.value='en';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>button('Convert & review all MCQs').click());
  await act(async()=>button('Apply to all 1 MCQs').click());
  expect(onApply).toHaveBeenCalledTimes(1);const applied=onApply.mock.calls[0][0];expect(applied.slides[2].text).toBe('Q.4 Capital?\nA) Mumbai\nB) Delhi');expect(applied.slides[2].correctOption).toBe(1);expect(applied.source).toBe(base.source);
 }finally{await act(async()=>root.unmount());host.remove();canvas.mockRestore();delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;}
});

it('automatically uses current MCQs, falls back to pasted content without slides, and follows changes within the same project',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const canvas=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
 const source=newProject();source.source='Q.4 राजधानी? / Capital?\nA) मुंबई / Mumbai\nB) दिल्ली / Delhi\nAnswer: B';
 const host=document.createElement('div'),root=createRoot(host),onApply=vi.fn(async()=>{});
 const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label)!;
 const question=()=> (host.querySelector('[aria-label="Question 1 Question en"]') as HTMLTextAreaElement).value;
 try{
  await act(async()=>root.render(<LanguageControls project={source} templates={templates} onApply={onApply}/>));
  expect(host.querySelector('[aria-label="Questions to convert"]')).toBeNull();expect(button('Convert & review all MCQs').disabled).toBe(false);
  await act(async()=>button('Convert & review all MCQs').click());expect(question()).toBe('Capital?');
  await act(async()=>button('Cancel').click());
  const current=prepareLanguageProject({...source,source:'Q.9 रंग? / Colour?\nA) लाल / Red\nB) नीला / Blue\nAnswer: B'},templates,'source');current.source=source.source;
  await act(async()=>root.render(<LanguageControls project={current} templates={templates} onApply={onApply}/>));
  await act(async()=>button('Convert & review all MCQs').click());expect(question()).toBe('Colour?');
  await act(async()=>button('Cancel').click());
  await act(async()=>root.render(<LanguageControls project={{...source,source:''}} templates={templates} onApply={onApply}/>));
  expect(button('Convert & review all MCQs').disabled).toBe(true);expect(onApply).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());canvas.mockRestore();delete(globalThis as any).IS_REACT_ACT_ENVIRONMENT;}
});
