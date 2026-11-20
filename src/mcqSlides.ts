import {answerColour} from './answers';
import {blankSlide,type Project,type Slide,type TemplateSet} from './model';
import {extractMCQs} from './mcq';
import {resolveSlide} from './layout';

export function fitMCQSlide(p:Project,s:Slide,templates:TemplateSet):Slide{
 const original={...p.style,...s.style};let next={...s};
 for(let step=0;step<=Math.max(original.size,original.optionSize)-20;step++){
  next={...s,style:{...s.style,size:Math.max(20,original.size-step),optionSize:Math.max(20,original.optionSize-step)}};
  if(!resolveSlide(p,next,templates,0).warnings.some(w=>/overflows|exceed/.test(w)))break;
 }
 return next;
}
export function createMCQDeck(p:Project,templates:TemplateSet,seed?:Slide){
 const analysis=extractMCQs(p.source);
 if(!analysis.questions.length)throw Error('No complete MCQs found. Paste a question followed by at least two labelled options, such as A) and B). Your current deck is unchanged.');
 const slides=analysis.questions.map(q=>{
  const s:Slide={...blankSlide(seed&&[2,3,4,5].includes(seed.templateIndex)?seed.templateIndex:p.theme.templateIndex),layout:'mcq',mcqOnly:true,name:q.question.replace(/\s+/g,' ').slice(0,65),text:q.text,blocks:[{id:q.id,kind:'question',text:q.text,answer:q.answerText,group:0}],sourceIds:[q.id],notes:'',correctOption:q.correctOption,answerReveal:q.correctOption!==undefined,answerOrigin:q.correctOption!==undefined?'source':undefined,answerWarning:q.answerWarning,answerColor:answerColour(seed?.answerColor),style:{...seed?.style},theme:seed?.theme?{...seed.theme}:undefined,optionsMode:seed?.optionsMode||'auto',reserve:seed?.reserve||'none',reserveWidth:seed?.reserveWidth??440,workSpace:seed?.workSpace??0};
  return fitMCQSlide(p,s,templates);
 });
 return{project:{...p,contentMode:'mcq-only' as const,answerMode:'questions' as const,slides},analysis};
}
