import type {Element,FontAsset} from './model';
import {hasLanguageFonts} from './languageFonts';
import {highlightedRuns} from './textHighlight';
import {keywordMetrics} from './keywordPadding';

type FontLine={ascent:number;descent:number;gap:number};
// Typographic units from the supplied font files, normalized by unitsPerEm.
const bundled:Record<string,FontLine>={Kokila:{ascent:1074/2048,descent:342/2048,gap:775/2048},Mangal:{ascent:2542/2048,descent:898/2048,gap:0},Aptos:{ascent:1923/2048,descent:577/2048,gap:0}};
let customData='',customLine:FontLine|undefined;
function customFontLine(font?:FontAsset){
 if(!font)return;
 if(font.data===customData)return customLine;
 customData=font.data;customLine=undefined;
 try{
  const bytes=Uint8Array.from(atob(font.data.split(',')[1]),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer),tables:Record<string,number>={};
  for(let i=0;i<view.getUint16(4);i++){const at=12+i*16;tables[String.fromCharCode(...bytes.slice(at,at+4))]=view.getUint32(at+8);}
  const units=view.getUint16(tables.head+18),os=tables['OS/2'];
  if(units&&os)customLine={ascent:view.getInt16(os+68)/units,descent:-view.getInt16(os+70)/units,gap:view.getInt16(os+72)/units};
 }catch{/* The validated font can still use the bundled family's metrics. */}
 return customLine;
}

export type KeywordBackground={x:number;y:number;w:number;h:number;color:string};
/** Independent backgrounds keep the question text editable without Office's large highlight cell. */
export function keywordBackgrounds(e:Element,kokila?:FontAsset):KeywordBackground[]{
 if(!e.highlight)return[];
 const font=e.font||'Noto Sans Devanagari',size=e.size||26,pixels=size*2;
 const lineHeight=size*(e.lineHeight||1.35)*2;
 const metrics=keywordMetrics('Hg',font,size,!!e.bold);
 const typography=(font==='Kokila'?customFontLine(kokila):undefined)||bundled[font]||{ascent:metrics.fontAscent/pixels,descent:metrics.fontDescent/pixels,gap:0};
 const natural=(typography.ascent+typography.descent+typography.gap)*pixels;
 const lower=(typography.descent+typography.gap/2)*pixels;
 // Office puts any extra leading above the first line, and scales the line cell
 // when exact spacing is tighter than the font's natural typographic height.
 const baseline=lineHeight-lower*Math.min(1,lineHeight/natural);
 const lines:ReturnType<typeof highlightedRuns>[]=[[]];
 for(const run of highlightedRuns(e))run.text.split('\n').forEach((text,index)=>{if(index)lines.push([]);if(text)lines.at(-1)!.push({...run,text});});
 const boxes:KeywordBackground[]=[];
 lines.forEach((runs,index)=>{
  const parts=runs.map(run=>({run,metrics:keywordMetrics(run.text,run.font||font,size,run.bold??e.bold??false)}));
  const faces=parts.map(({run,metrics:m})=>(run.font==='Kokila'?customFontLine(kokila):undefined)||bundled[run.font||font]||{ascent:m.fontAscent/pixels,descent:m.fontDescent/pixels,gap:0});
  const mixedNatural=faces.length?Math.max(...faces.map(f=>(f.ascent+f.descent+f.gap)*pixels)):natural;
  const mixedLower=faces.length?Math.max(...faces.map(f=>(f.descent+f.gap/2)*pixels)):lower;
  const lineBaseline=hasLanguageFonts(e)?lineHeight-mixedLower*Math.min(1,lineHeight/mixedNatural):baseline;
  const width=parts.reduce((sum,part)=>sum+part.metrics.width,0);
  let x=e.x+(e.w-width)*(e.align==='center'?.5:e.align==='right'?1:0);
  for(const {run,metrics:m} of parts){
   if(run.highlight&&run.text.trim())boxes.push({x:x-m.side,y:e.y+lineBaseline+index*lineHeight-m.ascent-m.pad,w:m.width+2*m.side,h:m.ascent+m.descent+2*m.pad,color:run.highlight});
   x+=m.width;
  }
 });
 return boxes;
}
