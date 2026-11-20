import {useEffect,useRef,useState} from 'react';
import {deviceTranslationAvailable,type TranslationEngine} from './translation';
export function useTranslationEngine(){
 const[engine,setValue]=useState<TranslationEngine>(deviceTranslationAvailable()?'device':'online'),[provider,setProvider]=useState(''),chosen=useRef(false);
 useEffect(()=>{let mounted=true;fetch('/api/refinement/status').then(r=>r.ok?r.json():null).then(data=>{if(mounted&&data?.available&&['Gemini','OpenAI','Groq'].includes(data.provider)){setProvider(data.provider);if(!chosen.current)setValue('cloud');}}).catch(()=>{});return()=>{mounted=false;};},[]);
 return{engine,provider,setEngine:(value:TranslationEngine)=>{chosen.current=true;setValue(value);}};
}
export function TranslationChoice({engine,provider,setEngine}:ReturnType<typeof useTranslationEngine>){return <><label className="field"><span>Translation</span><select aria-label="Translation method" value={engine} onChange={e=>setEngine(e.target.value as TranslationEngine)}>{provider&&<option value="cloud">AI · {provider}</option>}<option value="device">On this device · supported browsers</option><option value="online">Online · MyMemory</option></select></label></>;}
