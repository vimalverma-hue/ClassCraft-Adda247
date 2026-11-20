import {hasLanguageFonts} from './languageFonts';
import {highlightedRuns} from './textHighlight';
import type {Element} from './model';
type Run={text:string;options?:{bold?:boolean;highlight?:string;fontFace?:string;color?:string}};
/** Match the browser's Noto Latin fallback in native Office text runs. */
export function nativeText(e:Element,backgroundHighlights=false):Run[]{
 const runs:Run[]=highlightedRuns(e).map(run=>{const options={...(run.font?{fontFace:run.font}:{}),...(run.bold===undefined?{}:{bold:run.bold}),...(run.color?{color:run.color.replace('#','')}:{}),...(run.highlight&&!backgroundHighlights?{highlight:run.highlight.replace('#','')}:{})};return{text:run.text,...(Object.keys(options).length?{options}:{})};});
 if(hasLanguageFonts(e)||e.font!=='Noto Sans Devanagari')return runs;
 return runs.flatMap(r=>r.text.split(/([\u0900-\u097f\u1cd0-\u1cff\ua8e0-\ua8ff]+)/g).filter(Boolean).map(text=>({text,options:{...r.options,fontFace:/[\u0900-\u097f\u1cd0-\u1cff\ua8e0-\ua8ff]/.test(text)?e.font:'Noto Sans'}})));
}
