// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {ContentImport} from '../src/ContentImport';
class ReaderWorker {
 static stall=false;
 static latest:ReaderWorker;
 constructor(){ReaderWorker.latest=this;}
 onmessage:((e:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;ended=false;
 postMessage({name}:{name:string}){if(ReaderWorker.stall)return;queueMicrotask(()=>{if(!this.ended)this.onmessage?.({data:{type:'result',result:{name,text:'# Imported heading\n\nA complete paragraph.',warnings:[]}}});});}
 terminate(){this.ended=true;}
}
async function mount(){(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.stubGlobal('Worker',ReaderWorker);const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host),apply=vi.fn(async(_text:string,_append:boolean)=>{});await act(async()=>root.render(<ContentImport onImport={apply}><textarea defaultValue="Existing notes" aria-label="Teaching content"/></ContentImport>));return{host,root,apply,close:async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();delete(globalThis as any).IS_REACT_ACT_ENVIRONMENT;}};}
function button(host:HTMLElement,text:string){return [...host.querySelectorAll('button')].find(b=>b.textContent===text)!;}
async function upload(host:HTMLElement){const input=host.querySelector('input[type="file"]') as HTMLInputElement;Object.defineProperty(input,'files',{configurable:true,value:[{name:'notes.txt',size:15,arrayBuffer:async()=>new ArrayBuffer(15)}]});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));}
it('previews uploaded content, allows cancellation and explicit append without silently replacing existing text',async()=>{const c=await mount();try{await upload(c.host);expect((c.host.querySelector('[aria-label="Teaching content"]') as HTMLTextAreaElement).value).toBe('Existing notes');expect(c.apply).not.toHaveBeenCalled();expect(c.host.querySelector('[role="dialog"]')).not.toBeNull();await act(async()=>button(c.host,'Cancel').click());expect(c.apply).not.toHaveBeenCalled();await upload(c.host);await act(async()=>button(c.host,'Append to content').click());expect(c.apply).toHaveBeenCalledWith('# Imported heading\n\nA complete paragraph.',true);}finally{await c.close();}});
it('cancels a pending extraction and then imports another file without a stale result overwriting it',async()=>{const c=await mount();try{ReaderWorker.stall=true;await upload(c.host);await act(async()=>button(c.host,'Cancel extraction').click());expect(c.host.querySelector('[role="status"]')).toBeNull();expect(c.apply).not.toHaveBeenCalled();ReaderWorker.stall=false;await upload(c.host);await act(async()=>button(c.host,'Use as content').click());expect(c.apply).toHaveBeenCalledTimes(1);expect(c.apply.mock.calls[0][1]).toBe(false);}finally{ReaderWorker.stall=false;await c.close();}});
it('keeps a long extraction running while pages progress and times out only after inactivity',async()=>{
 vi.useFakeTimers();ReaderWorker.stall=true;const c=await mount();try{
  await upload(c.host);const worker=ReaderWorker.latest;
  for(const page of [100,200,300,400,500]){await act(async()=>vi.advanceTimersByTimeAsync(60000));await act(async()=>worker.onmessage?.({data:{type:'progress',message:`PDF page ${page} / 500`}}));expect(worker.ended).toBe(false);}
  await act(async()=>worker.onmessage?.({data:{type:'result',result:{name:'large.pdf',text:'All 500 pages extracted.',pages:500,warnings:[]}}}));expect(worker.ended).toBe(true);await act(async()=>button(c.host,'Use as content').click());expect(c.apply).toHaveBeenCalledWith('All 500 pages extracted.',false);
  await upload(c.host);await act(async()=>vi.advanceTimersByTimeAsync(90001));expect(ReaderWorker.latest.ended).toBe(true);expect(c.host.querySelector('[role="alert"]')?.textContent).toContain('timed out');
 }finally{ReaderWorker.stall=false;await c.close();vi.useRealTimers();}
});
