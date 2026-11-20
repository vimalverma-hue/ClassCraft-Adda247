import {isQuestionNumberLine} from './questionText.js';

export type AnswerKeyEntry={number:string;answer:string};
export const answerKeyNumber=(text:string)=>text.replace(/[०-९]/g,c=>String(c.charCodeAt(0)-0x966)).replace(/^0+(?=\d)/,'');
const clean=(text:string)=>text.normalize('NFKC').replace(/[०-९]/g,c=>String(c.charCodeAt(0)-0x966)).replace(/[\u200b\ufeff]/g,'').replace(/\u00a0/g,' ').replace(/\*\*|__/g,'').replace(/^\s*#{1,6}\s+/,'').trim();
const heading=/^(?:answers?\s*(?:key|sheet|table)|correct\s+answers|answers|उत्तर\s*(?:कुंजी|तालिका|सूची)|उत्तरमाला|सही\s*उत्तर|उत्तर)\s*(?:[:：.\-–—]\s*)?(.*)$/i;
const questionLabel=/^(?:questions?|q)\.?\s*(?:(?:nos?|numbers?)\.?)?\s*[:|]?\s*|^प्रश्न\s*(?:संख्या)?\s*[:|]?\s*/i;
const answerLabel=/^(?:answers?|ans)\.?\s*[:|]?\s*|^(?:सही\s*)?उत्तर\s*[:|]?\s*/i;
const token=String.raw`(?:\([A-Za-zअआइईकखगघ1-8]\)|\[[A-Za-zअआइईकखगघ1-8]\]|[A-Za-zअआइईकखगघ1-8])`;
const multi=String.raw`(?:\s*(?:/|&|and\b|or\b|और|या|,(?=\s*[A-Za-zअआइईकखगघ([]))\s*${token})*`;
const entry=new RegExp(String.raw`^(?:(?:Q(?:uestion)?\.?|प्रश्न)\s*(?:(?:No\.?|Number|संख्या)\s*)?[:.]?\s*)?(?:\(\s*(\d+)\s*\)|(\d+)(?!\d))\s*(?:[).:：,|\-–—=→]+\s*)?(?:(?:ans(?:wer)?\.?|correct\s+answer|(?:सही\s*)?उत्तर|का|के|की)\s*[:：.\-–—=]?\s*)?(${token}${multi})[.)]?(?=$|[\s,;|/])`,'i');

function row(text:string):AnswerKeyEntry[]|undefined{
 const result:AnswerKeyEntry[]=[];let rest=text.replace(/^[-•]\s+/,'').replace(/^[|\s]+/,'');
 while(rest){const m=entry.exec(rest);if(!m)return;result.push({number:answerKeyNumber(m[1]||m[2]),answer:m[3]});rest=rest.slice(m[0].length).replace(/^[\s,;|/]+/,'');}
 return result.length?result:undefined;
}
const separator=(text:string)=>!text||/^[-|:\s]+$/.test(text);
function unit(lines:string[],at:number):{end:number;entries:AnswerKeyEntry[]}|undefined{
 const text=lines[at].replace(/^\|\s*|\s*\|$/g,'');if(separator(text))return{end:at+1,entries:[]};
 const labels=text.replace(questionLabel,'').replace(answerLabel,'');
 if(labels!==text&&!labels.replace(/[.\s|]+/g,''))return{end:at+1,entries:[]};
 let next=at+1;while(next<lines.length&&separator(lines[next]))next++;
 const numbers=text.replace(questionLabel,'').split(/[\s,;|]+/).filter(Boolean),answers=(lines[next]||'').replace(answerLabel,'').split(/[\s,;|]+/).filter(Boolean);
 if(numbers.length>=2&&numbers.every(v=>/^\d+$/.test(v))&&numbers.length===answers.length&&answers.every(v=>/^(?:\(?[A-Za-zअआइईकखगघ]\)?|\[[A-Za-zअआइईकखगघ]\])$/.test(v)))return{end:next+1,entries:numbers.map((n,i)=>({number:answerKeyNumber(n),answer:answers[i]}))};
 const pairs=row(text);if(pairs)return{end:at+1,entries:pairs};
 if(isQuestionNumberLine(text)&&new RegExp('^'+token+'$').test(lines[next]||''))return{end:next+1,entries:[{number:answerKeyNumber(text.match(/\d+/)![0]),answer:lines[next]}]};
}

/** Extract only structured keys. Unlabelled suffixes still need real question-number matches. */
export function readAnswerKey(input:string){
 const original=input.replace(/\r\n?/g,'\n').replace(/\f/g,'\n\n---\n\n').split('\n'),lines=original.map(clean),kept=[...original],entries:AnswerKeyEntry[]=[];
 for(let i=0;i<lines.length;i++){
  const h=heading.exec(lines[i]);if(!h)continue;
  const first=lines[i];lines[i]=h[1];let end=i,found:AnswerKeyEntry[]=[];
  while(end<lines.length){const part=unit(lines,end);if(!part)break;found.push(...part.entries);end=part.end;}
  lines[i]=first;if(!found.length)continue;
  entries.push(...found);for(let j=i;j<end;j++){kept[j]='';lines[j]='';}kept[i]='---';i=end-1;
 }
 let start=0,trailing:AnswerKeyEntry[]=[];
 for(let i=0;i<lines.length;){const part=unit(lines,i);if(!part){i++;start=i;trailing=[];}else{trailing.push(...part.entries);i=part.end;}}
 const body=kept.join('\n');
 const candidate=new Set(trailing.map(e=>e.number)).size>=2&&trailing.some(e=>/[A-Za-zअआइईकखगघ]/.test(e.answer))?{body:kept.slice(0,start).join('\n'),entries:trailing}:undefined;
 return{body,entries,trailing:candidate};
}
