import {uid,type Project,type Slide,type TemplateSet} from './model';
import {ensureClassSlides} from './classSlides';
import {createTheorySlides,paginateTheory,theoryContent,type TheoryMode} from './theory';
import {languagePair,missingDirections,translateEntries,type LanguagePair,type LanguageMode,type LanguageEntry,type TranslateText} from './languages';

export type TheoryLanguageData={title?:LanguagePair;items:LanguagePair[]};
export type TheoryLanguageCache={groupId:string;partIndex:number;partCount:number;renderedTitle:string;renderedItems:string[];data?:TheoryLanguageData};
export type TheoryLanguageEntry={slideId:string;slideIds:string[];before:string;data:TheoryLanguageData};
const title=(s:Slide)=>s.edits['theory-title']??s.theory?.title??'';
const pair=(text:string)=>/^\$\$?.+\$\$?$/.test(text)?{hi:text,en:text}:languagePair(text);
const visible=(s:Slide)=>[title(s),...theoryContent(s)].filter(Boolean).join('\n\n');
const isTheory=(s:Slide)=>s.kind==='teaching'&&s.layout==='theory';
const presentation=(s:Slide)=>JSON.stringify([s.style,s.theme,s.reserve,s.reserveWidth,s.workSpace,s.templateIndex,s.notes,s.image,s.edits.heading]);

export function prepareTheoryLanguageProject(p:Project,_templates:TemplateSet,input:'slides'|'source',mode:TheoryMode='theory-bullets'){
 if(input==='source')return ensureClassSlides({...p,contentMode:mode,slides:createTheorySlides(p,mode,p.slides.find(isTheory)).slides},p);
 const slides=p.slides.filter(isTheory);
 if(!slides.length)throw Error('No theory slides found. Choose pasted content or create theory slides first.');
 if(slides.some(s=>s.locked||s.lockedElements.some(k=>k==='body'||k.startsWith('theory-'))))throw Error('Unlock the theory slides and their text before converting languages.');
 return ensureClassSlides(p);
}
export function theoryLanguageEntries(p:Project):TheoryLanguageEntry[]{
 const entries:TheoryLanguageEntry[]=[];
 for(let i=0;i<p.slides.length;i++){
  const s=p.slides[i];if(!isTheory(s))continue;
  const cache=s.theoryLanguages,parts=cache?p.slides.slice(i,i+cache.partCount):[];
  const reusable=cache?.partIndex===0&&cache.data&&parts.length===cache.partCount&&parts.every((part,j)=>{const c=part.theoryLanguages;return isTheory(part)&&presentation(part)===presentation(s)&&c?.groupId===cache.groupId&&c.partIndex===j&&title(part)===c.renderedTitle&&JSON.stringify(theoryContent(part))===JSON.stringify(c.renderedItems);});
  if(reusable){entries.push({slideId:s.id,slideIds:parts.map(part=>part.id),before:parts.map(visible).join('\n\n'),data:structuredClone(cache!.data!)});i+=parts.length-1;}
  else entries.push({slideId:s.id,slideIds:[s.id],before:visible(s),data:{title:title(s)?pair(title(s)):undefined,items:theoryContent(s).map(pair)}});
 }
 return entries;
}
// Reuse the proven field translator; each heading/paragraph is a standalone field.
function fields(entries:TheoryLanguageEntry[]):LanguageEntry[]{return entries.flatMap(entry=>[...(entry.data.title?[entry.data.title]:[]),...entry.data.items].map((value,i)=>({slideId:entry.slideId+'-'+i,before:'',data:{renderedText:'',prefix:'',question:value,options:[]}})));}
export function theoryMissingDirections(entries:TheoryLanguageEntry[],mode:LanguageMode){return missingDirections(fields(entries),mode);}
export async function translateTheoryEntries(entries:TheoryLanguageEntry[],mode:LanguageMode,translate:TranslateText,signal:AbortSignal,progress:(done:number,total:number)=>void){
 const translated=await translateEntries(fields(entries),mode,translate,signal,progress);let at=0;
 return entries.map(entry=>({...entry,data:{title:entry.data.title?translated[at++].data.question:undefined,items:entry.data.items.map(()=>translated[at++].data.question)}}));
}
export function theoryTranslationWarnings(data:TheoryLanguageData){
 const values=[...(data.title?[{name:'Heading',pair:data.title}]:[]),...data.items.map((pair,i)=>({name:'Paragraph '+(i+1),pair}))];
 const numbers=(s:string)=>[...s.replace(/[०-९]/g,c=>String(c.charCodeAt(0)-0x966)).matchAll(/\d+(?:[.,]\d+)*/g)].map(m=>m[0]).sort().join('|');
 return values.filter(v=>v.pair.hi&&v.pair.en&&numbers(v.pair.hi)!==numbers(v.pair.en)).map(v=>v.name+': numbers differ between languages. Check the translation.');
}
export function applyTheoryLanguageEntries(p:Project,entries:TheoryLanguageEntry[],mode:LanguageMode):Project{
 const render=(pair:LanguagePair)=>{const values=mode==='both'?[pair.hi,pair.en]:[pair[mode]];if(values.some(v=>!v?.trim()))throw Error('Complete the requested language for every heading and paragraph before applying.');return [...new Set(values.map(v=>v!.trim()))].join('\n');};
 const byId=new Map(entries.map(e=>[e.slideId,e])),removed=new Set(entries.flatMap(e=>e.slideIds.slice(1)));
 const slides=p.slides.flatMap(s=>{
  if(removed.has(s.id))return[];const entry=byId.get(s.id);if(!entry)return[s];
  const heading=entry.data.title?render(entry.data.title):'',text=entry.data.items.map(render).join('\n\n');
  const seed:Slide={...s,theory:{title:heading},text,manual:true,theoryLanguages:undefined,edits:Object.fromEntries(Object.entries(s.edits).filter(([key])=>key!=='body'&&!key.startsWith('theory-')))};
  const parts=paginateTheory(p,seed),groupId=uid();
  return parts.map((part,i)=>({...part,id:i?uid():s.id,theoryLanguages:{groupId,partIndex:i,partCount:parts.length,renderedTitle:title(part),renderedItems:theoryContent(part),...(i===0?{data:structuredClone(entry.data)}:{})}}));
 });
 return ensureClassSlides({...p,languageMode:mode,slides},p);
}
