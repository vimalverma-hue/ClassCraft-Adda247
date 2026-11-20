import type {Element} from './model';
import {highlightedRuns} from './textHighlight';
import {keywordMetrics} from './keywordPadding';

/** Visible glyph bounds within the existing line cells; never move the text. */
export function answerInkBounds(e:Element){
 const size=e.size||24,font=e.font||'Noto Sans Devanagari',lineHeight=size*2*(e.lineHeight||1.35);
 const strut=keywordMetrics('Hg',font,size,!!e.bold),lines:ReturnType<typeof highlightedRuns>[]=[[]];
 for(const run of highlightedRuns({...e,highlight:undefined}))run.text.split('\n').forEach((text,i)=>{if(i)lines.push([]);if(text)lines.at(-1)!.push({...run,text});});
 let top=Infinity,bottom=-Infinity;
 lines.forEach((runs,i)=>{
  const metrics=runs.filter(run=>run.text.trim()).map(run=>keywordMetrics(run.text,run.font||font,size,run.bold??e.bold??false));if(!metrics.length)return;
  const baseline=Math.max(...[strut,...metrics].map(m=>(lineHeight+m.fontAscent-m.fontDescent)/2));
  top=Math.min(top,e.y+i*lineHeight+baseline-Math.max(...metrics.map(m=>m.ascent)));
  bottom=Math.max(bottom,e.y+i*lineHeight+baseline+Math.max(...metrics.map(m=>m.descent)));
 });
 return Number.isFinite(top)?{top,bottom}:{top:e.y,bottom:e.y+lineHeight};
}
