import type {Project,Slide,TemplateSet} from './model';
import {answerOptions} from './answers';
import {compactQuestion,optionLine} from './parser';
import {questionPrefix} from './labelColour';
import {joinQuestionNumber} from './questionText';
import {createMCQDeck,fitMCQSlide} from './mcqSlides';
import {ensureClassSlides} from './classSlides';

export type Language='hi'|'en';
export type LanguageMode=Language|'both';
export type LanguagePair={hi?:string;en?:string};
export type LocalizedMCQ={renderedText:string;prefix:string;question:LanguagePair;options:(LanguagePair&{label:string})[]};
export type TranslateText=(text:string,from:Language,to:Language)=>Promise<string>;
export type LanguageEntry={slideId:string;before:string;data:LocalizedMCQ};
const hindi=/[\u0900-\u097f]/,latin=/[A-Za-z]/;

/** A slash or newline is a language separator only when scripts on its sides differ. */
export function languagePair(text:string):LanguagePair{
 text=text.trim();
 if(!/\p{L}/u.test(text))return{hi:text,en:text};
 for(const match of text.matchAll(/\s*\/\s*|\n+/g)){
  const left=text.slice(0,match.index).trim(),right=text.slice(match.index!+match[0].length).trim();
  if(hindi.test(left)&&!hindi.test(right)&&latin.test(right))return{hi:left,en:right};
  if(hindi.test(right)&&!hindi.test(left)&&latin.test(left))return{hi:right,en:left};
 }
 return hindi.test(text)?{hi:text}:{en:text};
}
export function visibleMCQ(s:Slide){
 const text=compactQuestion(s.edits.body??(s.text||s.blocks.map(b=>b.text).join('\n\n')));
 const lines=text.split('\n'),at=lines.findIndex(line=>optionLine.test(line));
 const question=joinQuestionNumber(s.edits.question??lines.slice(0,at<0?lines.length:at).join('\n')).trim();
 const options=answerOptions(s).map(o=>({label:o.label,text:o.text.replace(optionLine,'').trim()}));
 return{question,options,text:[question,...options.map(o=>o.label+' '+o.text)].join('\n')};
}
export function readLanguageEntry(s:Slide):LanguageEntry{
 const visible=visibleMCQ(s);
 if(visible.options.length<2)throw Error(`“${s.name}” needs at least two labelled options before language conversion.`);
 const cached=s.languages;
 if(cached&&cached.renderedText===visible.text&&cached.options?.length===visible.options.length)return{slideId:s.id,before:visible.text,data:structuredClone(cached)};
 const prefix=visible.question.match(questionPrefix)?.[0].trim()||'';
 return{slideId:s.id,before:visible.text,data:{renderedText:visible.text,prefix,question:languagePair(visible.question.slice(prefix.length)),options:visible.options.map(o=>({...languagePair(o.text),label:o.label}))}};
}
export function prepareLanguageProject(p:Project,templates:TemplateSet,input:'slides'|'source'){
 if(input==='source')return ensureClassSlides(createMCQDeck(p,templates,p.slides.find(s=>s.layout==='mcq')).project,p);
 // Two-question teaching slides become individual MCQs so each retains its own answer.
 const slides=p.slides.flatMap(s=>{
  if(s.kind!=='teaching'||s.layout!=='two-mcq')return[s];
  if(s.locked||s.lockedElements.length)throw Error('Unlock the MCQ slides and their text before converting languages.');
  const source=s.edits.body??(s.manual&&s.text?s.text:s.blocks.length?s.blocks.map(b=>b.text+(b.answer?'\n'+b.answer:'')).join('\n\n'):s.text);
  return createMCQDeck({...p,source},templates,s).project.slides;
 });
 const next=ensureClassSlides({...p,slides},p),mcqs=next.slides.filter(s=>s.kind==='teaching'&&s.layout==='mcq');
 if(!mcqs.length)throw Error('No MCQ slides found. Choose “Pasted content” or extract your questions first.');
 if(mcqs.some(s=>s.locked||s.lockedElements.some(k=>k==='body'||k==='question'||k.startsWith('option-'))))throw Error('Unlock the MCQ slides and their question/options before converting languages.');
 return next;
}
export function languageEntries(p:Project){return p.slides.filter(s=>s.kind==='teaching'&&s.layout==='mcq').map(readLanguageEntry);}
export function missingDirections(entries:LanguageEntry[],mode:LanguageMode){
 const targets:Language[]=mode==='both'?['hi','en']:[mode];const directions=new Set<string>();
 for(const entry of entries)for(const pair of [entry.data.question,...entry.data.options])for(const to of targets)if(!pair[to])directions.add((to==='hi'?'en':'hi')+'|'+to);
 return[...directions].map(d=>d.split('|') as [Language,Language]);
}
export async function translateEntries(entries:LanguageEntry[],mode:LanguageMode,translate:TranslateText,signal:AbortSignal,progress:(done:number,total:number)=>void){
 const next=structuredClone(entries),targets:Language[]=mode==='both'?['hi','en']:[mode];
 const jobs=next.flatMap(e=>[e.data.question,...e.data.options].flatMap(pair=>targets.filter(to=>!pair[to]).map(to=>({pair,to}))));
 const cache=new Map<string,string>();let done=0;progress(done,jobs.length);
 for(const {pair,to}of jobs){signal.throwIfAborted();const from:Language=to==='hi'?'en':'hi',text=pair[from];if(!text?.trim())throw Error('A question or option is empty. Add its text before translation.');const key=from+'|'+to+'|'+text;
  const value=cache.get(key)??await translate(text,from,to);signal.throwIfAborted();if(!value.trim())throw Error('Translation returned empty text. Existing slides are unchanged.');pair[to]=value.trim();cache.set(key,value.trim());progress(++done,jobs.length);
 }
 return next;
}
export function localizedText(data:LocalizedMCQ,mode:LanguageMode){
 const text=(pair:LanguagePair,separator:string)=>{const values=(mode==='both'?[pair.hi,pair.en]:[pair[mode]]);if(values.some(v=>!v?.trim()))throw Error('Complete the requested language for every question and option before applying.');return[...new Set(values.map(v=>v!.trim()))].join(separator);};
 return[(data.prefix?data.prefix+' ':'')+text(data.question,'\n'),...data.options.map(o=>o.label+' '+text(o,' / '))].join('\n');
}
export function translationWarnings(data:LocalizedMCQ){
 const warnings:string[]=[];const numbers=(s:string)=>[...s.replace(/[०-९]/g,c=>String(c.charCodeAt(0)-0x966)).matchAll(/\d+(?:[.,]\d+)*/g)].map(m=>m[0]).sort().join('|');
 for(const [i,pair] of [data.question,...data.options].entries())if(pair.hi&&pair.en){
  const name=i===0?'Question':data.options[i-1].label;
  if(numbers(pair.hi)!==numbers(pair.en))warnings.push(`${name}: numbers differ between languages. Check the translation.`);
  if(i===0&&/[?？]/.test(pair.hi)!==/[?？]/.test(pair.en))warnings.push('Question: one translation may be incomplete. Check that both versions ask the same question.');
 }
 return warnings;
}
export function applyLanguageEntries(p:Project,entries:LanguageEntry[],mode:LanguageMode,templates:TemplateSet):Project{
 const byId=new Map(entries.map(e=>[e.slideId,e]));
 return{...p,languageMode:mode,slides:p.slides.map(s=>{
  const entry=byId.get(s.id);if(!entry)return s;
  const text=localizedText(entry.data,mode),edits=Object.fromEntries(Object.entries(s.edits).filter(([key])=>key!=='body'&&key!=='question'&&!key.startsWith('option-')));
  const next:Slide={...s,text,edits,manual:true,languages:{...structuredClone(entry.data),renderedText:text},name:text.split('\n')[0].slice(0,65)};
  return fitMCQSlide(p,next,templates);
 })};
}
