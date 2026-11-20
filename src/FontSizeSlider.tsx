import {useEffect,useId,useState} from 'react';

export function FontSizeSlider({label,ariaLabel,value,min,max,step=1,unit='pt',disabled=false,onChange}:{label:string;ariaLabel?:string;value:number;min:number;max:number;step?:number;unit?:'pt'|'px';disabled?:boolean;onChange:(size:number)=>void}){
 const id=useId(),shown=Math.round(value*10)/10,limit=Math.max(max,Math.ceil(value));
 const name=ariaLabel||label+' font size';
 const [draft,setDraft]=useState<string|null>(null);
 useEffect(()=>setDraft(null),[value,min,max,disabled]);
 function commit(){
  if(!disabled&&draft!==null&&draft.trim()!==''&&Number.isFinite(Number(draft))){
   const entered=Math.min(limit,Math.max(min,Number(draft)));
   const next=Math.min(limit,Math.max(min,Math.round((min+Math.round((entered-min)/step)*step)*10)/10));
   if(next!==shown)onChange(next);
  }
  setDraft(null);
 }
 return <div className="field font-size-control"><span><label htmlFor={id}>{label}</label><span className="font-size-value"><input type="number" aria-label={name+' value'} min={min} max={limit} step={step} value={draft??shown} disabled={disabled} onFocus={event=>{setDraft(String(shown));event.currentTarget.select();}} onChange={event=>setDraft(event.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}else if(event.key==='Escape'){event.preventDefault();setDraft(null);}}}/><span aria-hidden="true">{unit}</span></span></span><input id={id} type="range" aria-label={name} aria-valuetext={shown+' '+unit} min={min} max={limit} step={step} value={shown} disabled={disabled} onChange={event=>{setDraft(null);onChange(+event.target.value);}}/></div>;
}
