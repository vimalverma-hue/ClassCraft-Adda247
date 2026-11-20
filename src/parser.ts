import {hasLanguageFonts,languageFontRuns,type LanguageFonts} from './languageFonts';
import {createTheoryFromBlocks} from './theory';

import {blankSlide, type Project, type Slide, type SourceBlock, type TextStyle} from './model';
import {extractMCQs,mcqOptionLine} from './mcq';
import {joinQuestionNumber} from './questionText';
export const optionLine=mcqOptionLine;
export function compactQuestion(text:string){return joinQuestionNumber(text).replace(/^(\s*\d+)\s*\n(?=\S)/gm,'$1 ').replace(/^(\s*(?:\(?[A-Ha-h]\s*[).:]|\([A-Ha-h]\)))\s*\n\s*(?=\S)/gm,'$1 ').replace(/\n{3,}/g,'\n\n');}
const qLine=/^\s*(?:(?:Q(?:uestion)?\.?|प्रश्न)\s*\d+\s*[).:：-]?|\d+\s*[).:]|(?:Q\.|Question\s*[:：]|प्रश्न\s*[:：]))\s*\S|^\s*\d+\s*$/i;
const answerLine=/^\s*(?:ans(?:wer)?|correct\s*answer|उत्तर|सही\s*उत्तर|explanation|व्याख्या|solution|हल)\s*[:：.\-]/i;
export function parseContent(input:string):SourceBlock[]{
 const lines=input.replace(/\r\n?/g,'\n').split('\n'), blocks:SourceBlock[]=[];let i=0,group=0;
 const push=(kind:SourceBlock['kind'],text:string,answer='',rows?:string[][])=>{if(text.trim())blocks.push({id:`src-${blocks.length}-${hash(text)}`,kind,text,answer,rows,group});};
 while(i<lines.length){
  if(lines[i].trim()==='---'){group++;i++;continue;}if(!lines[i].trim()){i++;continue;}
  if(lines[i].includes('\t')){const table=[];while(i<lines.length&&lines[i].includes('\t'))table.push(lines[i++]);push('table',table.join('\n'),'',table.map(r=>r.split('\t')));continue;}
  const start=i;let end=i+1;
  while(end<lines.length&&lines[end].trim()!=='---'&&!qLine.test(lines[end]))end++;
  const isQ=qLine.test(lines[i])&&lines.slice(i+1,end).some(l=>optionLine.test(l));
  if(isQ){let q:string[]=[],a:string[]=[],inAnswer=false;i=start;while(i<end){if(answerLine.test(lines[i]))inAnswer=true;(inAnswer?a:q).push(lines[i++]);}push('question',q.join('\n').trimEnd(),a.join('\n').trimEnd());continue;}
  const para=[lines[i++]];while(i<lines.length&&lines[i].trim()&&lines[i].trim()!=='---'&&!lines[i].includes('\t')){if(qLine.test(lines[i])&&lines.slice(i+1,i+12).some(l=>optionLine.test(l)))break;para.push(lines[i++]);}push('text',para.join('\n'));
 }
 return blocks;
}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);}
let ctx:CanvasRenderingContext2D|null=null;
export function measure(text:string,size:number,font:string,bold=false,fonts:LanguageFonts={}):number{if(hasLanguageFonts(fonts))return languageFontRuns(text,font,bold,fonts).reduce((width,run)=>width+measure(run.text,size,run.font,run.bold),0);if(typeof document!=='undefined'){ctx??=document.createElement('canvas').getContext('2d');if(ctx){ctx.font=`${bold?'700':'400'} ${size*2}px "${font}", "Noto Sans", sans-serif`;return ctx.measureText(text).width;}}return [...text].length*size*1.08;}
export function wrap(text:string,width:number,size:number,font:string,bold=false,fonts:LanguageFonts={}):string[]{
 const out:string[]=[];
 for(const para of text.split('\n')){if(!para){out.push('');continue;}let line='';for(const token of para.match(/\S+\s*|\s+/g)||[]){if(measure(line+token,width>0?size:20,font,bold,fonts)<=width){line+=token;continue;}if(line){out.push(line.trimEnd());line='';}if(measure(token,size,font,bold,fonts)>width){const segments=typeof Intl.Segmenter!=='undefined'?[...new Intl.Segmenter('hi',{granularity:'grapheme'}).segment(token)].map(s=>s.segment):[...token];for(const c of segments){if(line&&measure(line+c,size,font,bold,fonts)>width){out.push(line);line='';}line+=c;}}else line=token;}out.push(line.trimEnd());}
 return out;
}
export function contentGeometry(p:Project,s:Slide){const theme={...p.theme,...s.theme};const header=theme.mode==='original'?115:theme.headerHeight;let x=80,w=1760;const reserve=s.reserve==='none'?0:s.reserveWidth+36;if(s.reserve==='left')x+=reserve;w-=reserve;if(s.layout==='image'&&s.image)w=Math.max(500,w-660);return {x,y:Math.max(header+45,150),w,h:1080-Math.max(header+45,150)-90-s.workSpace};}
export function splitText(text:string,w:number,maxLines:number,style:TextStyle):string[]{
 if(wrap(text,w,style.size,style.font,style.bold,style).length<=maxLines)return[text];
 const tokens=text.match(/\S+\s*|\s+/g)||[text],parts:string[]=[];let current='';
 for(const token of tokens){if(current&&wrap(current+token,w,style.size,style.font,style.bold,style).length>maxLines){parts.push(current);current='';}if(wrap(token,w,style.size,style.font,style.bold,style).length>maxLines){const chars=typeof Intl.Segmenter!=='undefined'?[...new Intl.Segmenter('hi',{granularity:'grapheme'}).segment(token)].map(v=>v.segment):[...token];for(const c of chars){if(current&&wrap(current+c,w,style.size,style.font,style.bold,style).length>maxLines){parts.push(current);current='';}current+=c;}}else current+=token;}
 if(current)parts.push(current);return parts;
}
export function paginateSlide(p:Project,s:Slide):Slide[]{
 if(s.kind==='original'||s.locked||s.layout==='blank'||(s.mcqOnly&&s.layout==='mcq'))return[s];const style={...p.style,...s.style};const g=contentGeometry(p,s);const max=Math.max(1,Math.floor((g.h-60)/(style.size*2*style.lineHeight)));
 if(s.layout==='table'&&s.blocks[0]?.rows){const rows=s.blocks[0].rows;const cols=Math.max(...rows.map(r=>r.length));const cw=g.w/cols;const rh=(r:string[])=>Math.max(...r.map(c=>wrap(c,cw-32,style.size,style.font,style.bold||(!hasLanguageFonts(style)&&['Kokila','Mangal','Aptos'].includes(style.font)),style).length))*style.size*2*style.lineHeight+28;let chunk=[rows[0]],height=rh(rows[0]),out:Slide[]=[];for(const row of rows.slice(1)){const h=rh(row);if(chunk.length>1&&height+h>g.h){out.push({...s,id:out.length?s.id+'-part'+out.length:s.id,blocks:[{...s.blocks[0],rows:chunk,text:chunk.map(r=>r.join('\t')).join('\n')}]});chunk=[rows[0]];height=rh(rows[0]);}chunk.push(row);height+=h;}out.push({...s,id:out.length?s.id+'-part'+out.length:s.id,blocks:[{...s.blocks[0],rows:chunk,text:chunk.map(r=>r.join('\t')).join('\n')}]});return out;}
 const text=s.text||s.blocks.map(b=>b.kind==='question'?compactQuestion(b.text):b.text).join('\n\n');const parts=splitText(text,g.w,max,style);if(parts.length===1)return[s];
 return parts.map((text,i)=>({...s,id:i?s.id+'-part'+i:s.id,text,layout:s.layout==='two-mcq'?'mcq':s.layout,name:i?`${s.name} · continued ${i+1}`:s.name,continuation:i?`${s.name} · ${i+1}/${parts.length}`:undefined,blocks:s.blocks.map(b=>({...b,text:i===0?text:'',answer:i===parts.length-1?b.answer:''})),edits:{}}));
}
export function generateSlides(p:Project,layout:'auto'|'two-mcq'='auto'):Slide[]{
 const blocks=parseContent(p.source);if(!blocks.length)throw new Error('Paste teaching content before formatting.');
 const result:Slide[]=[];
 if(p.includeWelcome)result.push({...blankSlide(0),kind:'original',name:'Welcome'});
 for(let i=0;i<blocks.length;i++){
  if(blocks[i].kind==='text'){const run:SourceBlock[]=[];while(i<blocks.length&&blocks[i].kind==='text')run.push(blocks[i++]);i--;result.push(...createTheoryFromBlocks(p,run,p.style.bullets?'theory-bullets':'theory-paragraphs').slides);continue;}
  const block=blocks[i];const s={...blankSlide(p.theme.templateIndex),layout:(block.kind==='question'?'mcq':block.kind==='table'?'table':/^#{1,2}\s/.test(block.text)?'section':'theory') as Slide['layout'],blocks:[block],sourceIds:[block.id],name:block.text.split('\n')[0].slice(0,65),notes:p.answerMode==='notes'?(block.answer|| (block.kind==='question'?'Answer not provided':'')):''};
  if(layout==='two-mcq'&&block.kind==='question'&&blocks[i+1]?.kind==='question'&&blocks[i+1].group===block.group){const g=contentGeometry(p,s);const st=p.style;const count=wrap(block.text+'\n\n'+blocks[i+1].text,g.w,st.size,st.font,st.bold||(!hasLanguageFonts(st)&&['Kokila','Mangal','Aptos'].includes(st.font)),st).length;if(count*st.size*2*st.lineHeight<g.h-80){s.blocks.push(blocks[++i]);s.sourceIds.push(blocks[i].id);s.layout='two-mcq';if(p.answerMode==='notes')s.notes=s.blocks.map(b=>b.answer||'Answer not provided').join('\n\n');}}
  result.push(...paginateSlide(p,s));
  if(p.answerMode==='separate')for(const b of s.blocks.filter(b=>b.kind==='question'))result.push(...paginateSlide(p,{...blankSlide(p.theme.templateIndex),layout:'answer',name:'Answer · '+s.name,blocks:[b],sourceIds:[b.id],text:b.answer||'Answer not provided',showAnswers:true}));
 }
 if(p.includeClosing)result.push({...blankSlide(6),kind:'original',name:'Thank you'});return result;
}
export function auditSources(p:Project){const source=p.contentMode==='mcq-only'?extractMCQs(p.source).questions.map(q=>({id:q.id,kind:'question'})):parseContent(p.source).filter(b=>!p.contentMode?.startsWith('theory-')||b.kind!=='question');const ids=p.slides.filter(s=>s.layout!=='answer').flatMap(s=>s.sourceIds);return{total:source.length,questions:source.filter(b=>b.kind==='question').length,missing:source.filter(b=>!ids.includes(b.id)).map(b=>b.id)};}
