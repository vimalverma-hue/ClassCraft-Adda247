import {questionColourRuns} from './questionColours';
import {labelColourRuns,questionPrefix} from './labelColour';
import {boldFont,hasLanguageFonts,languageFontRuns} from './languageFonts';
import type {Element} from './model';

type HighlightRun={text:string;font?:string;bold?:boolean;color?:string;highlight?:string};
/** Use the source text while editing, without introducing visual wrap newlines. */
export function editingTextRuns(element:Element):HighlightRun[]{
 const text=element.editText??element.text??'',prefix=questionPrefix.exec(text)?.[0].trimEnd();
 const label=element.id==='question'&&prefix?element.runs?.find(run=>run.text===prefix&&run.color)?.color:undefined;
 return highlightedRuns({...element,text,lines:undefined,runs:label?labelColourRuns(text,'question',label,element.bold):undefined,highlight:undefined});
}
/** Match across wrapped lines and colour runs without changing the displayed text. */
export function highlightedRuns(element:Element):HighlightRun[]{
 const raw=element.runs??[{text:element.lines?.join('\n')??element.text??''}];
 let base:HighlightRun[]=raw;
 if(hasLanguageFonts(element)){
  // Resolve scripts across colour boundaries so a label's trailing space uses
  // the same face as it did during line measurement.
  let offset=0;
  const fonts=languageFontRuns(raw.map(r=>r.text).join(''),element.font||'Noto Sans Devanagari',!!element.bold,element).map(run=>{const start=offset;offset+=run.text.length;return{...run,start,end:offset};});
  offset=0;
  base=raw.flatMap(run=>{const start=offset,end=start+run.text.length;offset=end;return fonts.filter(f=>f.start<end&&f.end>start).map(f=>({...run,text:run.text.slice(Math.max(start,f.start)-start,Math.min(end,f.end)-start),font:f.font,bold:(run.bold??element.bold??false)||boldFont(f.font)}));});
 }
 if(element.id==='question')base=questionColourRuns(base,element);
 const keyword=element.highlight?.trim();
 if(!keyword)return base;
 const pattern=keyword.split(/\s+/u).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
 const text=base.map(run=>run.text).join('');
 const matches=[...text.matchAll(new RegExp(pattern,'gu'))].map(match=>({start:match.index,end:match.index+match[0].length}));
 let offset=0;
 return base.flatMap(run=>{
  const start=offset,end=start+run.text.length;offset=end;
  const boundaries=new Set([start,end]);
  for(const match of matches)if(match.start<end&&match.end>start){boundaries.add(Math.max(start,match.start));boundaries.add(Math.min(end,match.end));}
  const points=[...boundaries].sort((a,b)=>a-b);
  return points.slice(0,-1).map((from,index)=>({
   ...run,text:run.text.slice(from-start,points[index+1]-start),
   ...(matches.some(match=>from>=match.start&&from<match.end)?{highlight:element.highlightColor||'#ffcc4d',color:'#171925'}:{}),
  }));
 });
}
