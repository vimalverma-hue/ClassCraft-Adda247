import type {Language,TranslateText} from './languages';
export type TranslationEngine='device'|'online'|'cloud';
type NativeTranslator={translate:(text:string,options?:{signal:AbortSignal})=>Promise<string>;destroy:()=>void};
type NativeFactory={create:(options:{sourceLanguage:Language;targetLanguage:Language;signal:AbortSignal;monitor:(monitor:{addEventListener:(name:string,callback:(e:{loaded:number})=>void)=>void})=>void})=>Promise<NativeTranslator>};
const nativeFactory=()=>(globalThis as unknown as {Translator?:NativeFactory}).Translator;
export const deviceTranslationAvailable=()=>!!nativeFactory();
const onlineCache=new Map<string,string>();
const bytes=(s:string)=>new TextEncoder().encode(s).length;
/** Keep words intact and respect MyMemory's 500-byte UTF-8 request limit. */
export function translationChunks(text:string,max=480){
 const chunks:string[]=[];let current='';
 for(const word of text.match(/\S+\s*/g)||[]){
  if(bytes(word.trim())>max)throw Error('A word or formula is too long for online translation. Choose on-device translation or split the text.');
  if(bytes(current+word.trim())>max){chunks.push(current.trim());current='';}
  current+=word;
 }
 if(current.trim())chunks.push(current.trim());return chunks;
}
function decodeEntities(s:string){return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,entity:string)=>{const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};if(named[entity.toLowerCase()])return named[entity.toLowerCase()];const code=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return code>0&&code<=0x10ffff?String.fromCodePoint(code):_;});}
export async function onlineTranslate(text:string,from:Language,to:Language,signal:AbortSignal,fetcher:typeof fetch=fetch){
 const out:string[]=[];
 for(const chunk of translationChunks(text)){
  signal.throwIfAborted();const key=from+'|'+to+'|'+chunk;if(onlineCache.has(key)){out.push(onlineCache.get(key)!);continue;}
  const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',chunk);url.searchParams.set('langpair',from+'|'+to);url.searchParams.set('mt','1');
  const controller=new AbortController(),abort=()=>controller.abort(signal.reason);signal.addEventListener('abort',abort,{once:true});const timeout=setTimeout(()=>controller.abort(new DOMException('Translation service timed out. Try again or choose on-device translation.','TimeoutError')),30000);
  try{
   const response=await fetcher(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
   if(response.status===429)throw Error('Online translation daily limit reached. Choose on-device translation or try again later. Existing slides are unchanged.');
   if(!response.ok)throw Error(`Translation service is unavailable (${response.status}). Try on-device translation. Existing slides are unchanged.`);
   const data=await response.json();
   if(data.quotaFinished||Number(data.responseStatus)===429||/limit|quota/i.test(String(data.responseDetails||'')))throw Error('Online translation daily limit reached. Choose on-device translation or try again later. Existing slides are unchanged.');
   if(Number(data.responseStatus)!==200||typeof data.responseData?.translatedText!=='string'||!data.responseData.translatedText.trim())throw Error('The service could not translate this text. Try on-device translation. Existing slides are unchanged.');
   const translated=decodeEntities(data.responseData.translatedText).trim();onlineCache.set(key,translated);if(onlineCache.size>2000)onlineCache.delete(onlineCache.keys().next().value!);out.push(translated);
  }catch(e){if(signal.aborted)signal.throwIfAborted();if(controller.signal.aborted)throw controller.signal.reason;if(e instanceof TypeError)throw Error('Cannot reach online translation. Check your connection or choose on-device translation. Existing slides are unchanged.');throw e;}
  finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
 }
 return out.join(' ');
}
/** Call directly in the click handler so browser model creation retains user activation. */
export function translationSession(engine:TranslationEngine,directions:[Language,Language][],signal:AbortSignal,progress:(message:string)=>void):{translate:TranslateText;close:()=>void}{
 if(engine==='cloud')return{translate:(text,from,to)=>cloudTranslate(text,from,to,signal),close:()=>{}};
 if(engine==='online')return{translate:(text,from,to)=>onlineTranslate(text,from,to,signal),close:()=>{}};
 if(!directions.length)return{translate:async text=>text,close:()=>{}};
 const factory=nativeFactory();if(!factory)throw Error('On-device translation is unavailable in this browser. Choose Online translation or open this app in a supported desktop Chrome browser.');
 const instances:NativeTranslator[]=[];let closed=false;
 const translators=new Map(directions.map(([from,to])=>{
  const promise=factory.create({sourceLanguage:from,targetLanguage:to,signal,monitor:m=>m.addEventListener('downloadprogress',e=>progress(`Downloading ${from} → ${to} language pack · ${Math.round(e.loaded*100)}%`))}).then(translator=>{if(closed){translator.destroy();throw new DOMException('Cancelled','AbortError');}instances.push(translator);return translator;});
  // Attach a handler immediately; the other direction may download while a request runs.
  promise.catch(()=>{});return[from+'|'+to,promise] as const;
 }));
 return{translate:async(text,from,to)=>{try{signal.throwIfAborted();const translator=await translators.get(from+'|'+to);if(!translator)throw Error('Language pair unavailable.');return await translator.translate(text,{signal});}catch(e){if(signal.aborted)signal.throwIfAborted();throw Error('On-device translation could not start. Check the browser language-pack download, or choose Online translation. '+(e instanceof Error?e.message:''));}},close:()=>{closed=true;instances.forEach(t=>t.destroy());}};
}

export async function cloudTranslate(text:string,from:Language,to:Language,signal:AbortSignal,fetcher:typeof fetch=fetch){
 signal.throwIfAborted();const response=await fetcher('/api/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source:text,from,to}),signal});
 let data:{text?:string;error?:string};try{data=await response.json();}catch{throw Error('AI translation could not be reached. Reload the app and sign in if needed.');}
 if(!response.ok)throw Error(data.error||'AI translation failed. Existing slides are unchanged.');if(typeof data.text!=='string'||!data.text.trim())throw Error('AI returned an empty translation. Existing slides are unchanged.');return data.text;
}
