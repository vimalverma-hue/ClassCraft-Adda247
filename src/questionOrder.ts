import {joinQuestionNumber} from './questionText';
import {questionPrefix} from './labelColour';
import {mcqOptionLine} from './mcq';
export type QuestionLanguageOrder='original'|'hi-first'|'en-first';
export type QuestionOrderStyle={questionLanguageOrder?:QuestionLanguageOrder};
export function validateQuestionOrder(value:QuestionOrderStyle){if(value.questionLanguageOrder!==undefined&&!['original','hi-first','en-first'].includes(value.questionLanguageOrder))throw Error('Invalid question language order.');}
const hindi=/[\u0900-\u097f\u1cd0-\u1cff\ua8e0-\ua8ff]/u,latin=/[A-Za-z]/;
const hindiBlock=(text:string)=>hindi.test(text)&&text.split(/\n+/).every(line=>hindi.test(line)||!latin.test(line));
const englishBlock=(text:string)=>latin.test(text)&&!hindi.test(text);
function bilingualPair(body:string){
 const hiFirst:{hi:string;en:string}[]=[],enFirst:{hi:string;en:string}[]=[];
 for(const separator of body.matchAll(/\n+|[ \t]*\/[ \t]*/g)){
  const left=body.slice(0,separator.index).trim(),right=body.slice(separator.index!+separator[0].length).trim();
  // A fraction is content, including when its slash has surrounding spaces.
  if(separator[0].includes('/')&&/[0-9०-९]\s*$/.test(left)&&/^\s*[0-9०-९]/.test(right))continue;
  if(hindiBlock(left)&&englishBlock(right))hiFirst.push({hi:left,en:right});
  if(englishBlock(left)&&hindiBlock(right))enFirst.push({hi:right,en:left});
 }
 // Alternating/mixed blocks are ambiguous: never discard or guess at their content.
 if(!!hiFirst.length===!!enFirst.length)return;
 return hiFirst[0]||enFirst.at(-1)!;
}
/** Display preference only: source wording and saved translations stay intact. */
export function orderedQuestion(text:string,order?:QuestionLanguageOrder):string{
 const joined=joinQuestionNumber(text).trimEnd();
 if(!order||order==='original')return joined;
 const match=questionPrefix.exec(joined),prefix=match?.[0].trim()||'',body=joined.slice(match?.[0].length||0).trim();
 const pair=bilingualPair(body);if(!pair)return joined;
 const first=order==='en-first'?pair.en:pair.hi,second=order==='en-first'?pair.hi:pair.en;
 return(prefix?prefix+' ':'')+first+'\n'+second;
}
/** Reorder wording inside one option; its label and answer identity never change. */
export function orderedOption(text:string,order?:QuestionLanguageOrder):string{
 if(!order||order==='original')return text;
 const match=mcqOptionLine.exec(text),prefix=match?.[0].trim()||'',body=text.slice(match?.[0].length||0).trim();
 const pair=bilingualPair(body);if(!pair)return text;
 const first=order==='en-first'?pair.en:pair.hi,second=order==='en-first'?pair.hi:pair.en;
 return(prefix?prefix+' ':'')+first+' / '+second;
}
