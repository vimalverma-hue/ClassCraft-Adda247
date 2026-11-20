import type {Element,Project} from './model';
import {mcqOptionLine} from './mcq';
export const questionPrefix=/^[ \t]*(?:(?:Q(?:uestion)?\.?|प्रश्न(?:[ \t]*संख्या)?)[ \t]*(?:(?:No\.?|Number)[ \t]*)?[:.：\-]?[ \t]*[0-9०-९]+[ \t]*[).:：\-]?|\([0-9०-९]+\)|[0-9०-९]+[ \t]*[).:：\-])/i;

export function labelColourRuns(text:string,mode:'question'|'option'|'both',colour:string,bold?:boolean):NonNullable<Element['runs']>{
 const runs:NonNullable<Element['runs']>=[];
 text.split('\n').forEach((line,index)=>{
  const prefix=(mode==='both'?line.match(mcqOptionLine)?.[0]||line.match(questionPrefix)?.[0]:index===0?line.match(mode==='option'?mcqOptionLine:questionPrefix)?.[0]:undefined)?.trimEnd();
  if(index)runs.push({text:'\n',bold});
  if(prefix){runs.push({text:prefix,color:colour,bold});runs.push({text:line.slice(prefix.length),bold});}else runs.push({text:line,bold});
 });
 return runs;
}
export function applyLabelColour(p:Project,colour:string):Project{
 return{...p,style:{...p.style,labelColor:colour},slides:p.slides.map(s=>({...s,style:{...s.style,labelColor:colour}}))};
}

export function bulletColourRuns(text:string,colour:string,bold?:boolean):NonNullable<Element['runs']>{return text.split('\n').flatMap((line,i)=>{const m=line.match(/^(\s*•)/);return [...(i?[{text:'\n',bold}]:[]),...(m?[{text:m[0],color:colour,bold},{text:line.slice(m[0].length),bold}]:[{text:line,bold}])];});}
