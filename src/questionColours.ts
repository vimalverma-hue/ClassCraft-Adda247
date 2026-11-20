import {languageTextRuns} from './languageFonts';
import {questionPrefix} from './labelColour';
import {readableColour} from './colourContrast';
export type QuestionColours={questionHindiColor?:string;questionEnglishColor?:string};
export const hasQuestionColours=(value:QuestionColours)=>!!(value.questionHindiColor||value.questionEnglishColor);
export function questionColourFields(value:QuestionColours,background:string):QuestionColours{
 return {...(value.questionHindiColor?{questionHindiColor:readableColour(value.questionHindiColor,background)}:{}),...(value.questionEnglishColor?{questionEnglishColor:readableColour(value.questionEnglishColor,background)}:{})};
}
export function validateQuestionColours(value:QuestionColours){for(const colour of [value.questionHindiColor,value.questionEnglishColor])if(colour!==undefined&&colour!==''&&!/^#[\da-f]{6}$/i.test(colour))throw Error('Invalid question colour.');}
/** Colour only the wording; Q.1 keeps its independently configured label colour. */
export function questionColourRuns<T extends {text:string;color?:string}>(runs:T[],value:QuestionColours):T[]{
 if(!hasQuestionColours(value))return runs;
 const text=runs.map(run=>run.text).join(''),prefixEnd=questionPrefix.exec(text)?.[0].trimEnd().length||0;
 let offset=0;
 const languages=languageTextRuns(text).map(run=>{const start=offset;offset+=run.text.length;return{...run,start,end:offset};});
 offset=0;
 return runs.flatMap(run=>{
  const start=offset,end=start+run.text.length;offset=end;
  const boundaries=new Set([start,end]);if(prefixEnd>start&&prefixEnd<end)boundaries.add(prefixEnd);
  for(const part of languages){if(part.start>start&&part.start<end)boundaries.add(part.start);if(part.end>start&&part.end<end)boundaries.add(part.end);}
  const points=[...boundaries].sort((a,b)=>a-b);
  return points.slice(0,-1).map((from,index)=>{
   const language=languages.find(part=>part.start<=from&&part.end>from)?.language;
   const colour=from<prefixEnd?undefined:language==='hi'?value.questionHindiColor:value.questionEnglishColor;
   return {...run,text:run.text.slice(from-start,points[index+1]-start),...(colour?{color:colour}:{})};
  });
 });
}
