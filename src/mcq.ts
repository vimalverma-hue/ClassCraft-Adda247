import {joinQuestionNumber,isQuestionNumberLine} from './questionText.js';
import {readAnswerKey,answerKeyNumber} from './answerKey.js';
/** Local MCQ extraction. Source content is never rewritten or sent to a service. */
export type MCQOption={label:string;text:string;marked:boolean};
export type ExtractedMCQ={id:string;number?:string;question:string;options:MCQOption[];text:string;answerText:string;correctOption?:number;answerWarning?:string};
type Choice={label:string;key:string;order:number;text:string};
const letters='ABCDEFGH',hindi1='अआइई',hindi2='कखगघ';
export const mcqOptionLine=/^\s*(?:\([A-Ha-hअआइईकखगघ1-8]\)|\[[A-Ha-hअआइईकखगघ1-8]\]|[A-Ha-hअआइईकखगघ]\s*[).:\-]|[1-8]\s*[):])\s*/;
const choicePattern=/^\s*(\(([A-Ha-hअआइईकखगघ1-8])\)|\[([A-Ha-hअआइईकखगघ1-8])\]|([A-Ha-hअआइईकखगघ1-8])\s*[).:\-])\s*(.*)$/;
const numberPrefix=/^\s*(?:(?:Q(?:uestion)?\.?|प्रश्न)\s*(?:(?:No\.?|Number|संख्या)\s*)?[:.\-]?\s*(\d+)\s*[).:：\-]?|\((\d+)\)|(?:प्रश्न|Question|Q)\s*[:.\-]|(\d+)\s*[).:：])\s*/i;
const explicitQuestion=/^\s*(?:Q(?:uestion)?\.?|प्रश्न)\s*(?:(?:No\.?|Number|संख्या)\s*)?(?:[0-9०-९]|[:.\-])/i;
const questionWords=/^(?:which|what|who|whom|whose|when|where|why|how|select|choose|identify|find|consider|read|given|determine|match|निम्न|कौन|किस|कितन|कब|कहाँ|क्यों|क्या|चुनिए|बताइए|दिए|दिये|यदि|इनमें|उपर्युक्त)/i;
const answerMarker=/^\s*(?:(?:the\s+)?correct\s+(?:answer|option)(?:\s+is)?|ans(?:wer)?(?:\s+is)?|(?:सही\s*)?(?:उत्तर|जवाब|विकल्प)(?:\s+है)?)\s*(?:[:：.\-–=]\s*|\s+|$)(.*)$/i;
const explanationMarker=/^\s*(?:explanation|description|solution|soln?|reason|rationale|note|व्याख्या|विवरण|स्पष्टीकरण|समाधान|हल|कारण|टिप्पणी)(?:\s*[:：.\-–]|\s*$|\s+(?:is|है)\b)/i;
const noise=/^\s*(?:view\s+(?:answer|solution)|show\s+(?:answer|solution)|hide\s+(?:answer|solution)|discuss(?:ion)?|save|bookmark|report(?:\s+an?\s+error)?|share|read\s+more|उत्तर\s*देखें|व्याख्या\s*देखें|download|advertisement)\s*[.→↗:!]*\s*$/i;
const answerKeyHeading=/^\s*(?:answer\s*key|answers\s*key|उत्तर\s*(?:कुंजी|तालिका)|उत्तरमाला)\s*[:：.\-]?\s*$/i;
const explanationProse=/^(?:this\s+(?:is|means|shows)|the\s+correct\s+answer|hence\b|therefore\b|because\b|यह\s+(?:इसलिए|उत्तर|विकल्प)|क्योंकि|अतः|इसलिए)/i;
const devanagariDigits=(s:string)=>s.replace(/[०-९]/g,c=>String(c.charCodeAt(0)-0x966));
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(16);};
function choice(line:string):Choice|undefined{if(/^\s*\d+\./.test(line))return;const m=choicePattern.exec(line);if(!m)return;const key=(m[2]||m[3]||m[4]).toUpperCase();const order=letters.includes(key)?letters.indexOf(key):hindi1.includes(key)?hindi1.indexOf(key):hindi2.includes(key)?hindi2.indexOf(key):Number(key)-1;return{label:m[1],key,order,text:m[5]};}
function meta(line:string){return answerMarker.test(line)||explanationMarker.test(line)||answerKeyHeading.test(line)||noise.test(line)||/^\s*---+\s*$/.test(line);}
function questionLike(line:string){return explicitQuestion.test(line)||questionWords.test(line.replace(numberPrefix,''))||/[?？]/.test(line);}
function normalize(input:string){
 const lines:string[]=[];
 for(let line of input.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').replace(/[\u200b\ufeff]/g,'').split('\n')){
  line=line.replace(/\*\*|__/g,'').replace(/^\s*#{1,6}\s+/,'').trim();
  // Split inline answer metadata before splitting compact A/B/C/D options.
  const marks=[...line.matchAll(/(?:^|\s+)(?:(?:correct\s+(?:answer|option)|ans(?:wer)?|सही\s*उत्तर|उत्तर|explanation|description|व्याख्या|विवरण|solution|हल)\s*[:：=–]|Ans\.\s*)/gi)];
  const offsets=marks.map(m=>m.index!).filter(at=>at===0||!!choice(line)||/(?:^|\s)(?:\([B-Hb-hअआइईकखगघ2-8]\)|\[[B-Hb-hअआइईकखगघ2-8]\]|[B-Hb-hअआइईकखगघ][).:])/.test(line.slice(0,at)));
  const cuts=[0,...offsets.filter(at=>at>0),line.length];const sections=cuts.slice(0,-1).map((at,i)=>line.slice(at,cuts[i+1]).trim());
  for(const section of sections){
   if(meta(section)){lines.push(section);continue;}
   const matches=[...section.matchAll(/(?:^|\s+)(\([A-Ha-hअआइईकखगघ1-8]\)|\[[A-Ha-hअआइईकखगघ1-8]\]|[A-Ha-hअआइईकखगघ]\s*[).:\-])\s*/g)];
   const sequence=matches.filter(m=>choice(m[1])!==undefined);
   if(sequence.length>=2&&sequence[0]&&choice(sequence[0][1])?.order===0&&sequence.every((m,i)=>choice(m[1])?.order===i)){
    const first=sequence[0].index!;if(section.slice(0,first).trim())lines.push(section.slice(0,first).trim());
    sequence.forEach((m,i)=>lines.push(section.slice(m.index!,sequence[i+1]?.index??section.length).trim()));
   }else lines.push(section);
  }
 }
 return lines;
}
function stemBefore(lines:string[],floor:number,end:number){
 let start=end;while(start>floor&&!lines[start-1].trim())start--;const stop=start;
 // A supplied question heading wins over preceding notes or explanation.
 const strong=[];for(let i=floor;i<stop;i++)if(explicitQuestion.test(lines[i]))strong.push(i);
 if(strong.length)start=strong.at(-1)!;
 else{
  let boundary=floor;for(let i=floor;i<stop;i++)if(meta(lines[i]))boundary=i+1;
  const numbered=[];for(let i=boundary;i<stop;i++)if(numberPrefix.test(devanagariDigits(lines[i]))||isQuestionNumberLine(lines[i]))numbered.push(i);
  const likely=numbered.filter(i=>questionLike(lines[i])||isQuestionNumberLine(lines[i]));
  if(likely.length)start=likely.at(-1)!;
  else if(numbered.length)start=numbered[0];
  else{start=stop;while(start>boundary&&lines[start-1].trim())start--;const natural=[];for(let i=start;i<stop;i++)if(questionLike(lines[i]))natural.push(i);if(natural.length)start=natural[0];}
 }
 let parts=lines.slice(start,stop).filter(l=>!noise.test(l)&&!meta(l));while(parts.length&&!parts[0].trim())parts.shift();
 if(!parts.length)return;
 const first=devanagariDigits(parts[0]);let number=numberPrefix.exec(first);let n=number?.[1]||number?.[2]||number?.[3]||(isQuestionNumberLine(first)?first.match(/\d+/)?.[0]:undefined);
 if(/^\d+$/.test(first)&&parts.length>1){n=first;parts=[first+'. '+parts.slice(1).join('\n')];}
 // A bare numeric question prefix must not resemble a numeric option.
 else if(/^\s*(?:\(\d+\)|\d+\))/.test(first))parts[0]=first.replace(/^\s*(?:\((\d+)\)|(\d+)\))/,(m,a,b)=>`${a||b}.`);
 const rawQuestion=parts.join('\n').trim(),question=joinQuestionNumber(rawQuestion);if(!question||question.length<3)return;
 return{start,question,rawQuestion,number:n};
}
const cleanValue=(s:string)=>s.normalize('NFKC').toLocaleLowerCase().replace(/\*\*|__/g,'').replace(/[\s.,:;!?।()[\]{}'"“”‘’\-–—]+/g,'').trim();
function matchAnswer(raw:string,options:MCQOption[]):number|undefined{
 let text=raw.trim().replace(/^[:：.\-–=]+\s*/,'').replace(/^(?:option|विकल्प)\s*[:：.\-–=]?\s*/i,'').trim();
 const exact=options.map((o,i)=>cleanValue(o.text)===cleanValue(text)?i:-1).filter(i=>i>=0);if(exact.length===1)return exact[0];
 const m=/^(?:\(([A-Ha-hअआइईकखगघ1-8])\)|\[([A-Ha-hअआइईकखगघ1-8])\]|([A-Ha-hअआइईकखगघ1-8])(?=$|\s|[).:\-।]))\s*[).:\-]?\s*(.*)$/.exec(text);if(!m)return;
 const key=(m[1]||m[2]||m[3]).toUpperCase(),rest=m[4].trim();
 if(/^(?:and|or|&|\/|,|और|या)\s*\(?[A-Ha-hअआइईकखगघ1-8]/i.test(rest))return;
 const index=options.findIndex(o=>choice(o.label)?.key===key);if(index<0)return;
 const bodyMatch=options.map((o,i)=>cleanValue(o.text)===cleanValue(rest)?i:-1).filter(i=>i>=0);if(bodyMatch.length===1&&bodyMatch[0]!==index)return;
 return index;
}
function resolveAnswer(values:string[],options:MCQOption[],marked:number[]){
 const indexes=new Set(marked);let unresolved=false;
 for(const value of values){const i=matchAnswer(value,options);if(i===undefined)unresolved=true;else indexes.add(i);}
 if(indexes.size===1&&!unresolved)return{correctOption:[...indexes][0],answerWarning:undefined};
 if(indexes.size>1||unresolved)return{correctOption:undefined,answerWarning:'Supplied answer is ambiguous or does not match one option. Mark it manually.'};
 return{correctOption:undefined,answerWarning:undefined};
}
function readQuestions(lines:string[]){
 const keyStart=lines.findIndex(l=>answerKeyHeading.test(l)),limit=keyStart<0?lines.length:keyStart;
 const raw:{start:number;end:number;question:string;rawQuestion:string;number?:string;options:MCQOption[]}[]=[];let floor=0;
 for(let at=0;at<limit;at++){
  if(choice(lines[at])?.order!==0)continue;
  const stem=stemBefore(lines,floor,at);if(!stem)continue;
  const options:MCQOption[]=[];let pos=at,end=at;
  while(pos<limit){
   const c=choice(lines[pos]);if(!c||c.order!==options.length)break;
   let chunks=c.text?[c.text]:[];let next=pos+1;let trailing=false;
   while(next<limit){const l=lines[next],ch=choice(l);
    if(ch||meta(l)||explicitQuestion.test(l)||((options.length>0||chunks.length>0)&&(numberPrefix.test(devanagariDigits(l))||isQuestionNumberLine(l)))||explanationProse.test(l)){break;}
    if(!l.trim()){
     let j=next+1;while(j<limit&&!lines[j].trim())j++;
     if(choice(lines[j]||'')?.order===options.length+1){next=j;break;}
     if(!chunks.length){next++;continue;}
     trailing=true;break;
    }
    if(chunks.length&&questionLike(l)){
     let j=next+1;while(j<limit&&!lines[j].trim())j++;if(choice(lines[j]||'')?.order===0)break;
    }
    chunks.push(l);next++;
   }
   let text=chunks.join('\n').trim();if(!text)break;
   const marked=/(?:✅|✓|✔|\((?:correct|सही)\)|\[(?:correct|सही)\])\s*$/i.test(text);
   if(marked)text=text.replace(/\s*(?:✅|✓|✔|\((?:correct|सही)\)|\[(?:correct|सही)\])\s*$/i,'').trim();
   options.push({label:c.label,text,marked});end=next;
   if(trailing||choice(lines[next]||'')?.order!==options.length)break;pos=next;
  }
  if(options.length<2)continue;
  raw.push({...stem,options,end});floor=end;at=end-1;
 }
 return{raw,limit};
}
export function extractMCQs(input:string):{questions:ExtractedMCQ[];matchedAnswers:number;needsReview:number}{
 const section=readAnswerKey(input);let entries=[...section.entries,...(section.trailing?.entries||[])],lines=normalize(section.trailing?.body??section.body),{raw,limit}=readQuestions(lines);
 if(section.trailing){const numbers=new Set(raw.filter(q=>q.number).map(q=>answerKeyNumber(q.number!))),matched=new Set(section.trailing.entries.filter(e=>numbers.has(e.number)).map(e=>e.number)),completeLines=normalize(section.body),complete=readQuestions(completeLines);if(matched.size<2||complete.raw.length>raw.length){entries=section.entries;lines=completeLines;({raw,limit}=complete);}}
 const keys=new Map<string,string[]>(),counts=new Map<string,number>();
 for(const entry of entries)keys.set(entry.number,[...(keys.get(entry.number)||[]),entry.answer]);
 for(const q of raw)if(q.number){const n=answerKeyNumber(q.number);counts.set(n,(counts.get(n)||0)+1);}
 const questions=raw.map((q,i)=>{
  const values:string[]=[];const answerLines:string[]=[];const tail=lines.slice(q.end,raw[i+1]?.start??limit);
  for(let j=0;j<tail.length;j++){const m=answerMarker.exec(tail[j]);if(m){const v=m[1].trim()||tail[j+1]?.trim();if(v&&!meta(v)){values.push(v);answerLines.push(tail[j]+(m[1].trim()?'':' '+v));}}}
  const number=q.number?answerKeyNumber(q.number):undefined;
  if(number&&keys.has(number)){values.push(...keys.get(number)!);answerLines.push('Answer key: '+keys.get(number)!.join(', '));if(counts.get(number)!>1)values.push('Ambiguous duplicate question number');}
  const answer=resolveAnswer(values,q.options,q.options.flatMap((o,j)=>o.marked?[j]:[]));
  const text=q.question+'\n'+q.options.map(o=>o.label+' '+o.text).join('\n');
  return{id:`mcq-${i}-${hash(q.rawQuestion+'\n'+q.options.map(o=>o.label+' '+o.text).join('\n'))}`,number:q.number,question:q.question,options:q.options,text,answerText:answerLines.join('\n')||q.options.filter(o=>o.marked).map(o=>'Marked: '+o.label).join('\n'),...answer};
 });
 return{questions,matchedAnswers:questions.filter(q=>q.correctOption!==undefined).length,needsReview:questions.filter(q=>q.answerWarning).length};
}
