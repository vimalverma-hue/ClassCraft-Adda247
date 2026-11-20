import {hasLanguageFonts,languageFontFields,type LanguageFonts} from './languageFonts';
import {theorySections,pairedTheoryText} from './theoryAnalysis';
export {theorySections,pairedTheoryText} from './theoryAnalysis';
import {blankSlide,type Project,type Slide,type Element,type SourceBlock} from './model';
import {parseContent,contentGeometry,wrap,splitText,paginateSlide} from './parser';
import {readableColour} from './colourContrast';

export type TheoryMode='theory-bullets'|'theory-paragraphs';
export function theoryContent(s:Slide){const text=s.edits.body??s.text;return text.split(/\n\s*\n/).filter(v=>v.trim()).map((v,i)=>s.edits['theory-item-'+i]??v.trim());}
export const THEORY_MIN_LINE_HEIGHT=1.4,THEORY_HEADING_LINE_HEIGHT=1.3,THEORY_DEFAULT_LANGUAGE_GAP=8;
const headingAfter=20;
export const theoryLanguageGap=(p:Project,s:Slide)=>Math.max(0,Math.min(48,({...p.style,...s.style}).translationGap??THEORY_DEFAULT_LANGUAGE_GAP));
function pairHeight(text:string,w:number,size:number,font:string,bold:boolean,lineHeight:number,gap:number,fonts:LanguageFonts={}){const pair=pairedTheoryText(text);return wrap(pair.primary,w,size,font,bold,fonts).length*size*2*lineHeight+(pair.secondary?gap+wrap(pair.secondary,w,size,font,bold,fonts).length*size*2*lineHeight:0);}
export function theoryLayout(p:Project,s:Slide):{elements:Element[];warnings:string[]}{
 const st={...p.style,...s.style,lineHeight:Math.max(THEORY_MIN_LINE_HEIGHT,({...p.style,...s.style}).lineHeight)},t={...p.theme,...s.theme},g=contentGeometry(p,s),colour=st.color||t.textColor,bold=st.bold||(!hasLanguageFonts(st)&&['Kokila','Mangal','Aptos'].includes(st.font)),languageGap=theoryLanguageGap(p,s);
 const bg=t.mode==='original'?(t.variant==='dark'?'#191b1c':'#ffffff'):t.background,headingColour=st.headingColor?readableColour(st.headingColor,bg):colour,bulletColour=st.bulletColor||st.labelColor;
 const elements:Element[]=[],warnings:string[]=[];let y=g.y;
 const addPair=(id:string,text:string,x:number,w:number,size:number,weight:boolean,color:string,lineHeight:number)=>{
  const pair=pairedTheoryText(text);
  // Keep language element IDs stable while arranging each heading/point for display.
  const parts=pair.secondary?[{suffix:'',value:pair.primary},{suffix:'-en',value:pair.secondary}]:[{suffix:'',value:pair.primary}];
  if(st.questionLanguageOrder==='en-first'&&pair.secondary)parts.reverse();
  const full=parts.map(part=>part.value).join('\n');
  const add=(suffix:string,value:string)=>{const lines=wrap(value,w,size,st.font,weight,st),h=lines.length*size*2*lineHeight;elements.push({id:id+suffix,kind:'text',text:value,lines,x,y,w,h,size,font:st.font,...languageFontFields(st),bold:weight,color,lineHeight,align:st.align,editable:true,editId:id,editText:full});y+=h;};
  parts.forEach((part,i)=>{if(i)y+=languageGap;add(part.suffix,part.value);});
 };
 const title=s.edits['theory-title']??s.theory?.title??'';
 if(title){addPair('theory-title',title,g.x,g.w,st.titleSize,true,headingColour,THEORY_HEADING_LINE_HEIGHT);y+=headingAfter;}
 theoryContent(s).forEach((text,i)=>{
  const equation=/^\$\$?(.+?)\$\$?$/.exec(text),list=st.bullets&&!equation&&!/^\d+[.)]\s/.test(text),indent=list?42:0,w=g.w-indent;
  if(list)elements.push({id:'theory-bullet-'+i,kind:'text',text:'•',x:g.x,y,w:32,h:st.size*2*st.lineHeight,size:st.size,font:st.font,color:bulletColour?readableColour(bulletColour,bg):colour,lineHeight:st.lineHeight});
  if(equation){elements.push({id:'theory-item-'+i,kind:'equation',text:equation[1],x:g.x,y,w,h:st.size*4,size:st.size,font:st.font,color:colour});y+=st.size*4;}
  else addPair('theory-item-'+i,text,g.x+indent,w,st.size,bold,colour,st.lineHeight);
  y+=Math.max(8,st.paragraphGap);
 });
 const bottom=y-(theoryContent(s).length?Math.max(8,st.paragraphGap):title?headingAfter:0);
 if(bottom>g.y+g.h+1)warnings.push('Theory content exceeds available height. Reflow / split this slide.');
 return{elements,warnings};
}
function splitTheoryPair(text:string,w:number,height:number,st:Project['style'],languageGap:number):string[]{
 const lh=st.size*2*st.lineHeight,bold=st.bold||(!hasLanguageFonts(st)&&['Kokila','Mangal','Aptos'].includes(st.font)),pair=pairedTheoryText(text),measure=(value:string)=>pairHeight(value,w,st.size,st.font,bold,st.lineHeight,languageGap,st);
 if(measure(text)<=height)return[pair.secondary?pair.primary+'\n'+pair.secondary:pair.primary];
 if(!pair.secondary)return splitText(pair.primary,w,Math.max(1,Math.floor(height/lh)),{...st,bold}).map(v=>v.trim());
 const budget=Math.floor((height-languageGap)/lh);if(budget<2)throw Error('Not enough teaching space for Hindi and English at this font size. Reduce the reserved space or heading height.');
 const sentences=(value:string,lang:string)=>typeof Intl.Segmenter==='undefined'?[value]:[...new Intl.Segmenter(lang,{granularity:'sentence'}).segment(value)].map(s=>s.segment.trim()).filter(Boolean);
 const a=sentences(pair.primary,'hi'),b=sentences(pair.secondary,'en');
 if(a.length>1&&a.length===b.length){
  const result:string[]=[];let hi='',en='';
  for(let i=0;i<a.length;i++){const nextHi=[hi,a[i]].filter(Boolean).join(' '),nextEn=[en,b[i]].filter(Boolean).join(' ');if(hi&&measure(nextHi+'\n'+nextEn)>height){result.push(hi+'\n'+en);hi='';en='';}
   if(measure(a[i]+'\n'+b[i])>height){result.push(...splitTheoryPair(a[i]+'\n'+b[i],w,height,st,languageGap));}
   else{hi=[hi,a[i]].filter(Boolean).join(' ');en=[en,b[i]].filter(Boolean).join(' ');}
  }if(hi)result.push(hi+'\n'+en);return result;
 }
 // When sentence boundaries differ, preserve both full texts in paired continuations.
 let hi=pair.primary,en=pair.secondary;const result:string[]=[];
 while(hi||en){
  if(!hi||!en){result.push(...splitText(hi||en,w,Math.max(1,Math.floor(height/lh)),{...st,bold}).map(v=>v.trim()));break;}
  const hiLines=wrap(hi,w,st.size,st.font,bold,st).length,enLines=wrap(en,w,st.size,st.font,bold,st).length,hiBudget=Math.max(1,Math.min(budget-1,Math.round(budget*hiLines/(hiLines+enLines))));
  const h=splitText(hi,w,hiBudget,{...st,bold}),e=splitText(en,w,budget-hiBudget,{...st,bold});result.push(h[0].trim()+'\n'+e[0].trim());hi=h.slice(1).join('').trim();en=e.slice(1).join('').trim();
 }return result;
}
export function paginateTheory(p:Project,s:Slide):Slide[]{
 if(s.locked||s.lockedElements.length)return[s];
 const st={...p.style,...s.style,lineHeight:Math.max(THEORY_MIN_LINE_HEIGHT,({...p.style,...s.style}).lineHeight)},g=contentGeometry(p,s),languageGap=theoryLanguageGap(p,s),gap=Math.max(8,st.paragraphGap),lineHeight=st.size*2*st.lineHeight;
 if(g.w<100||g.h<lineHeight)throw Error('Not enough teaching space at this font size. Reduce the reserved space.');
 let title=s.edits['theory-title']??s.theory?.title??'';
 const items=theoryContent(s),titleHeight=title?pairHeight(title,g.w,st.titleSize,st.font,true,THEORY_HEADING_LINE_HEIGHT,languageGap,st)+headingAfter:0,minBody=items.some(v=>pairedTheoryText(v).secondary)?lineHeight*2+languageGap:lineHeight;
 const pages:{title:string;items:string[]}[]=[];
 if(titleHeight>g.h-(items.length?minBody:0)){
  for(const part of splitTheoryPair(title,g.w,g.h,{...st,size:st.titleSize,bold:true,lineHeight:THEORY_HEADING_LINE_HEIGHT},languageGap))pages.push({title:part,items:[]});title='';
 }
 const available=g.h-(title?titleHeight:0);let current:string[]=[],height=0;
 const heightOf=(text:string,w:number,equation=false)=>equation?st.size*4:pairHeight(text,w,st.size,st.font,st.bold||(!hasLanguageFonts(st)&&['Kokila','Mangal','Aptos'].includes(st.font)),st.lineHeight,languageGap,st);
 const pageDone=()=>{if(current.length)pages.push({title,items:current});current=[];height=0;};
 const add=(text:string,h:number)=>{height+=(current.length?gap:0)+h;current.push(text);};
 const joinParts=(parts:string[],bilingual:boolean)=>{if(!bilingual)return parts.join(' ').trim();const hi:string[]=[],en:string[]=[];for(const part of parts){const pair=pairedTheoryText(part);if(pair.secondary){hi.push(pair.primary);en.push(pair.secondary);}else (/[\u0900-\u097f]/.test(pair.primary)?hi:en).push(pair.primary);}return [hi.join(' '),en.join(' ')].filter(Boolean).join('\n');};
 for(const item of items){
  const equation=/^\$\$?.+\$\$?$/.test(item),list=st.bullets&&!equation&&!/^\d+[.)]\s/.test(item),w=g.w-(list?42:0);
  if(equation&&st.size*4>available)throw Error('An equation is too tall for the reserved teaching space.');
  let rest=item;
  while(rest){
   const room=available-height-(current.length?gap:0),h=heightOf(rest,w,equation),bilingual=!!pairedTheoryText(rest).secondary;
   if(h<=room+.01){add(rest,h);break;}
   const minimum=bilingual?lineHeight*2+languageGap:lineHeight*2;
   // Short points stay intact; long paragraphs use the space remaining on this page.
   if(current.length&&(equation||room<minimum||(h<=lineHeight*2+languageGap&&h<=available))){pageDone();continue;}
   let parts=splitTheoryPair(rest,w,room,st,languageGap),head=parts[0],tail=joinParts(parts.slice(1),bilingual);
   // Avoid a final one-word continuation when one more line can move with it.
   if(tail&&tail.split(/\s+/).length<=3&&room-lineHeight>=minimum){parts=splitTheoryPair(rest,w,room-lineHeight,st,languageGap);head=parts[0];tail=joinParts(parts.slice(1),bilingual);}
   if(!head||heightOf(head,w)>room+1)throw Error('Not enough teaching space at this font size. Reduce the reserved space.');
   add(head,heightOf(head,w));rest=tail;if(rest)pageDone();
  }
 }
 if(current.length||!pages.length)pages.push({title,items:current});
 return pages.map((page,i)=>({...s,id:i?s.id+'-theory-'+i:s.id,name:(page.title||'Theory notes')+(i?' · '+(i+1):''),text:page.items.join('\n\n'),theory:{title:page.title},edits:Object.fromEntries(Object.entries(s.edits).filter(([key])=>key==='heading')),continuation:undefined}));
}
export function createTheorySlides(p:Project,mode:TheoryMode,seed?:Slide){return createTheoryFromBlocks(p,parseContent(p.source),mode,seed);}
export function createTheoryFromBlocks(p:Project,raw:SourceBlock[],mode:TheoryMode,seed?:Slide){
 const out:Slide[]=[];let skipped=0,pending:SourceBlock[]=[];
 const make=(extra:Partial<Slide>):Slide=>({...blankSlide(seed&&[2,3,4,5].includes(seed.templateIndex)?seed.templateIndex:p.theme.templateIndex),style:{...seed?.style,bullets:mode==='theory-bullets'},theme:seed?.theme?{...seed.theme}:undefined,timer:seed?.timer,reserve:seed?.reserve||'none',reserveWidth:seed?.reserveWidth??440,workSpace:seed?.workSpace??0,...extra});
 const flush=()=>{if(!pending.length)return;let text='';for(const [i,block] of pending.entries())text+=(i?(block.group===pending[i-1].group?'\n\n':'\n\n---\n\n'):'')+block.text;
  for(const section of theorySections(text,mode==='theory-bullets')){
   const s=make({layout:'theory',theory:{title:section.title},name:section.title||'Theory notes',text:section.items.join('\n\n'),sourceIds:pending.map(b=>b.id),blocks:[...pending]});out.push(...paginateTheory(p,s));
  }pending=[];
 };
 for(const block of raw){if(block.kind==='text'){pending.push(block);continue;}flush();if(block.kind==='question'){skipped++;continue;}out.push(...paginateSlide(p,make({layout:'table',blocks:[block],sourceIds:[block.id],name:'Theory table'})));}flush();
 if(!out.length)throw Error('No theory text found. Paste or upload notes, headings or paragraphs. Recognized MCQ blocks are excluded from theory-only mode.');
 return{slides:out,skipped};
}
