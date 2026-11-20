// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {installButtonRipples} from '../src/buttonRipples';

let stop:()=>void;
beforeEach(()=>{
 vi.useFakeTimers();
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false})));
 stop=installButtonRipples();
});
afterEach(()=>{stop();document.body.replaceChildren();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
function control(html='<button><span>Save</span></button>'){
 const wrapper=document.createElement('div');wrapper.innerHTML=html;document.body.append(wrapper);
 const host=wrapper.firstElementChild as HTMLElement;
 vi.spyOn(host,'getBoundingClientRect').mockReturnValue({left:40,top:20,width:120,height:48,right:160,bottom:68,x:40,y:20,toJSON(){}});
 return host;
}
function click(host:HTMLElement,detail=1,x=60,y=32){host.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail,clientX:x,clientY:y}));}
function centre(ripple:HTMLElement){return [parseFloat(ripple.style.left)+parseFloat(ripple.style.width)/2,parseFloat(ripple.style.top)+parseFloat(ripple.style.height)/2];}

it('starts at the pointer inside a nested icon/label without intercepting the action',()=>{
 const button=control(),action=vi.fn();button.addEventListener('click',action);
 click(button.firstElementChild as HTMLElement);
 const ripple=button.querySelector<HTMLElement>('.button-ripple')!;
 expect(centre(ripple)).toEqual([20,12]);expect(ripple.getAttribute('aria-hidden')).toBe('true');
 expect(button.textContent).toBe('Save');expect(action).toHaveBeenCalledOnce();
 expect((action.mock.calls[0][0] as MouseEvent).defaultPrevented).toBe(false);
});
it('centres keyboard activation and cleans up after animation',()=>{
 const button=control();button.click();
 const ripple=button.querySelector<HTMLElement>('.button-ripple')!;
 expect(centre(ripple)).toEqual([60,24]);
 ripple.dispatchEvent(new Event('animationend'));
 expect(button.querySelector('.button-ripple')).toBeNull();expect(button.style.position).toBe('');expect(button.style.overflow).toBe('');expect(vi.getTimerCount()).toBe(0);
});
it('keeps absolute positioning and restores existing overflow',()=>{
 const button=control();button.style.position='absolute';button.style.overflow='visible';click(button);
 expect(button.style.position).toBe('absolute');expect(button.style.overflow).toBe('hidden');
 vi.advanceTimersByTime(550);expect(button.style.position).toBe('absolute');expect(button.style.overflow).toBe('visible');
});
it('converts pointer coordinates correctly inside scaled controls',()=>{
 const button=control();Object.defineProperties(button,{offsetWidth:{value:240},offsetHeight:{value:96},clientWidth:{value:240},clientHeight:{value:96}});
 click(button);expect(centre(button.querySelector<HTMLElement>('.button-ripple')!)).toEqual([40,24]);
});
it('ignores disabled, aria-disabled, inert and zero-size controls',()=>{
 for(const html of ['<button disabled>Save</button>','<button aria-disabled="true">Save</button>','<button inert>Save</button>','<label class="upload-button">Upload<input disabled type="file"/></label>']){
  const button=control(html);click(button);expect(button.querySelector('.button-ripple')).toBeNull();
 }
 const hidden=document.createElement('button');document.body.append(hidden);click(hidden);expect(hidden.children.length).toBe(0);
});
it('respects the reduced-motion preference on each click',()=>{
 const button=control();vi.mocked(matchMedia).mockReturnValue({matches:true} as MediaQueryList);click(button);
 expect(button.querySelector('.button-ripple')).toBeNull();expect(button.getAttribute('style')).toBeNull();
 vi.mocked(matchMedia).mockReturnValue({matches:false} as MediaQueryList);click(button);expect(button.querySelector('.button-ripple')).not.toBeNull();
});
it('supports dynamically inserted upload labels and accordion summaries',()=>{
 const upload=control('<label class="upload-button">Add Image<input type="file" hidden/></label>');
 click(upload);const first=upload.querySelector('.button-ripple');expect(first).not.toBeNull();
 click(upload.querySelector('input')!);expect(upload.querySelector('.button-ripple')).toBe(first);
 const summary=control('<summary><strong>Add Timer</strong></summary>');click(summary.firstElementChild as HTMLElement);expect(summary.querySelector('.button-ripple')).not.toBeNull();
});
it('restarts rapid clicks without accumulating nodes or timers, then removes the listener',()=>{
 const button=control();for(let i=0;i<8;i++)click(button);
 expect(button.querySelectorAll('.button-ripple').length).toBe(1);expect(vi.getTimerCount()).toBe(1);
 stop();expect(button.querySelector('.button-ripple')).toBeNull();expect(vi.getTimerCount()).toBe(0);
 click(button);expect(button.querySelector('.button-ripple')).toBeNull();
});
it('cleans up disconnected buttons and leaves slide editing/drag handles alone',()=>{
 const button=control();click(button);button.remove();vi.advanceTimersByTime(550);expect(button.querySelector('.button-ripple')).toBeNull();
 const canvas=control('<div role="button" aria-label="Move timer">30</div>');click(canvas);expect(canvas.querySelector('.button-ripple')).toBeNull();
});
it('preserves React actions and reconciliation while a button label and state change',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 function Demo(){const [count,setCount]=useState(0);return <button className={count?'active':''} onClick={()=>setCount(n=>n+1)}>{count?'Saved '+count:'Save'}</button>;}
 try{
  await act(async()=>root.render(<Demo/>));const button=host.querySelector('button')!;
  vi.spyOn(button,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:120,height:48} as DOMRect);
  for(let i=1;i<=3;i++){await act(async()=>button.click());expect(button.textContent).toBe('Saved '+i);expect(button.className).toBe('active');}
  await act(async()=>vi.advanceTimersByTime(550));expect(button.querySelector('.button-ripple')).toBeNull();expect(button.textContent).toBe('Saved 3');
 }finally{await act(async()=>root.unmount());delete(globalThis as any).IS_REACT_ACT_ENVIRONMENT;}
});
