import type {Element,ResolvedSlide,Slide} from './model';
import {compactQuestion,optionLine,measure} from './parser';
import {contrastRatio,readableColour} from './colourContrast';
import {answerInkBounds} from './answerGeometry';
export const defaultAnswerColour='#86efac';
/** Refresh the old built-in pale green while retaining teacher-selected colours. */
export const answerColour=(value?:string)=>!value||value.toLowerCase()==='#bbf7d0'?defaultAnswerColour:value;
export type AnswerOption={index:number;label:string;text:string};
export function answerOptions(s:Slide):AnswerOption[]{
 if(s.layout!=='mcq')return[];
 const text=s.edits.body??s.text??'';
 const lines=compactQuestion(text||s.blocks.map(b=>b.text).join('\n\n')).split('\n');
 const out:AnswerOption[]=[];
 for(const line of lines){const m=line.match(optionLine);if(m)out.push({index:out.length,label:m[0].trim(),text:line});else if(out.length)out[out.length-1].text+='\n'+line;}
 return out.map(o=>({...o,text:s.edits['option-'+o.index]??o.text}));
}
export function answerOverlay(s:Slide,r:ResolvedSlide):Element|undefined{
 if(s.correctOption===undefined||!s.answerReveal)return;
 const chosen=answerOptions(s).find(o=>o.index===s.correctOption);if(!chosen)return;
 const target=r.elements.find(e=>e.id==='option-'+chosen.index);if(!target)return;
 const fill=answerColour(s.answerColor),whiteText=contrastRatio('#ffffff',fill)>contrastRatio('#12291c',fill);
 // Fit the longest rendered line using the same font metrics as slide wrapping.
 // Keep existing line breaks and the left/centre/right text anchor unchanged.
 const lines=target.lines||(target.text||'').split('\n');
 const textWidth=Math.min(target.w,Math.ceil(Math.max(...lines.map(line=>measure(line,target.size||24,target.font||'Noto Sans Devanagari',target.bold,target))))+8);
 const textX=target.x+(target.w-textWidth)*(target.align==='right'?1:target.align==='center'?.5:0);
 const textHeight=lines.length*(target.size||24)*2*(target.lineHeight||1.35);
 const left=Math.min(18,textX),right=Math.min(18,1920-textX-textWidth);
 const top=Math.min(8,target.y),bottom=Math.min(8,1080-target.y-textHeight);
 const ink=answerInkBounds(target),pad=Math.max(3,Math.min(6,(target.size||24)*.12));let boxTop=Math.max(0,ink.top-pad),boxBottom=Math.min(1080,ink.bottom+pad+2);
 // Limit padding in a tight option stack without clipping the answer's glyphs.
 for(const other of r.elements){if(other===target||other.kind!=='text'||!(/^(?:question|option-\d+)$/.test(other.id))||other.x>=textX+textWidth+right||other.x+other.w<=textX-left)continue;const adjacent=answerInkBounds(other);if(adjacent.bottom<=ink.top)boxTop=Math.max(boxTop,(adjacent.bottom+ink.top)/2);if(adjacent.top>=ink.bottom)boxBottom=Math.min(boxBottom,(adjacent.top+ink.bottom)/2);}
 return {...target,id:'answer-reveal',x:textX-left,y:target.y-top,w:textWidth+left+right,h:textHeight+top+bottom,answerBox:{x:textX-left,y:boxTop,w:textWidth+left+right,h:boxBottom-boxTop},padding:[top,right,bottom,left],valign:'middle',fill,color:whiteText?'#ffffff':readableColour('#12291c',fill),runs:target.runs?.map(r=>whiteText?{...r,color:'#ffffff'}:r.color?{...r,color:readableColour(r.color,fill)}:r),editable:false,highlight:undefined,highlightColor:undefined};
}
export function revealAnswer(s:Slide,r:ResolvedSlide):ResolvedSlide{const overlay=answerOverlay(s,r);return overlay?{...r,elements:[...r.elements.filter(e=>e.kind!=='timer'),overlay,...r.elements.filter(e=>e.kind==='timer')]}:r;}
