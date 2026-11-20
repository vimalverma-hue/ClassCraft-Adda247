import {headerTextColour} from './headerColour';
import {questionOptionsGap} from './questionSpacing';
import {orderedQuestion,orderedOption} from './questionOrder';
import {questionColourFields} from './questionColours';
import {hasLanguageFonts,languageFontFields} from './languageFonts';
import {orderedElements} from './layerOrder';
import {normalizeImage,thumbnailImage} from './slideImages';
import {fixedSlot} from './classSlides';
import {textBoxElement} from './textBoxes';
import {slideTimer} from './timers';
﻿import type {Element,Project,ResolvedSlide,Slide,TemplateSet} from './model';
import {contentGeometry,optionLine,wrap,compactQuestion} from './parser';
import {joinQuestionNumber} from './questionText';
import {bulletColourRuns,labelColourRuns} from './labelColour';
import {readableColour} from './colourContrast';
import {theoryLayout} from './theory';
export function resolveSlide(p:Project,s:Slide,templates:TemplateSet,page:number):ResolvedSlide{
 const t={...p.theme,...s.theme},st={...p.style,...s.style},color=st.color||t.textColor; if(!hasLanguageFonts(st)&&['Kokila','Mangal','Aptos'].includes(st.font))st.bold=true;const elements:Element[]=[],warnings:string[]=[];
 const add=(e:Element)=>{if(e.id==='question'&&s.layout==='mcq')e={...e,...questionColourFields(st,t.mode==='original'?(t.variant==='dark'?'#191b1c':'#ffffff'):t.background)};if((e.kind==='text'||e.kind==='table')&&!e.id.startsWith('template-'))e={...languageFontFields(st),...e};if(e.id==='content-image'&&s.image){const asset=p.assets[s.image],frame=fixedSlot(s)==='thumbnail'?thumbnailImage():normalizeImage(s.imagePlacement||{x:e.x,y:e.y,w:e.w,h:e.h,fit:e.fit==='cover'?'cover':'contain'});e={...e,...frame,imageFixed:fixedSlot(s)==='thumbnail',imageCrop:frame.crop,imageSize:asset?[asset.width,asset.height]:undefined};}const value=e.id.startsWith('theory-')?e.text:(s.edits[e.id]??e.text);const text=e.id==='question'&&value!==undefined?orderedQuestion(value,st.questionLanguageOrder):s.layout==='mcq'&&e.id.startsWith('option-')&&value!==undefined?orderedOption(value,st.questionLanguageOrder):value;if(e.kind==='text'&&text!==undefined){if(!hasLanguageFonts(e)&&['Mangal','Aptos'].includes(e.font||''))e={...e,bold:true};e={...e,runs:text===e.text?e.runs:undefined,text,lines:wrap(text,e.w,e.size||st.size,e.font||st.font,e.bold,e),highlight:st.highlight,highlightColor:st.highlightColor};const labelMode=e.id==='question'?'question':e.id.startsWith('option-')?'option':s.layout==='two-mcq'&&e.id==='body'?'both':undefined;if(labelMode&&st.labelColor&&/^#[0-9a-f]{6}$/i.test(st.labelColor))e.runs=labelColourRuns(e.lines!.join('\n'),labelMode,readableColour(st.labelColor,t.mode==='original'?(t.variant==='dark'?'#191b1c':'#ffffff'):t.background),e.bold);if(st.bullets&&e.id==='body'&&!['mcq','two-mcq'].includes(s.layout)&&(st.bulletColor||st.labelColor))e.runs=bulletColourRuns(e.lines!.join('\n'),readableColour(st.bulletColor||st.labelColor!,t.mode==='original'?(t.variant==='dark'?'#191b1c':'#ffffff'):t.background),e.bold);const required=e.lines!.length*(e.size||st.size)*2*(e.lineHeight||st.lineHeight);if(required>e.h+2)warnings.push('Text overflows. Use “Reflow / split” or reduce reserved space.');}elements.push(e);};
 if(t.mode==='original'){
  const template=templates[t.variant].slides[s.templateIndex]||templates[t.variant].slides[t.templateIndex];
  for(const [i,item] of template.items.entries()){if(item.kind==='text'&&s.image&&s.templateIndex===1)continue;add({id:'template-'+i,...item,kind:item.kind,text:item.text,font:item.font,size:item.size,fit:'fill',lineHeight:1.1,editable:item.kind==='text'});}
 }else{
  if(t.backgroundImage)add({id:'background',kind:'image',src:p.assets[t.backgroundImage]?.data,x:0,y:0,w:1920,h:1080,fit:t.backgroundFit,opacity:t.backgroundOpacity,objectPosition:`${t.backgroundX}% ${t.backgroundY}%`});
  const art=s.templateIndex===0?t.welcome:s.templateIndex===6?t.closing:undefined;
  if(art)add({id:'artwork',kind:'image',src:p.assets[art]?.data,x:0,y:0,w:1920,h:1080,fit:'contain'});
  else {
   if(t.headerHeight>0&&t.headerColor!=='transparent')add({id:'header',kind:'rect',x:0,y:0,w:1920,h:t.headerHeight,fill:t.headerColor});
   if(t.headerImage)add({id:'banner',kind:'image',src:p.assets[t.headerImage]?.data,x:0,y:0,w:1920,h:t.headerHeight,fit:t.headerFit});
   const logo=(t.variant==='dark'?t.logoDark:t.logoLight)||t.logo;
   if(logo){const a=p.assets[logo];add({id:'logo',kind:'image',src:a?.data,x:t.logoX+t.logoPadding,y:t.logoY+t.logoPadding,w:Math.max(20,t.logoWidth-t.logoPadding*2),h:Math.max(20,t.headerHeight-t.logoY-2*t.logoPadding),fit:'contain'});}
   if(t.watermark){const a=p.assets[t.watermark];add({id:'watermark',kind:'image',src:a?.data,x:t.watermarkX,y:t.watermarkY,w:t.watermarkWidth,h:a?t.watermarkWidth*a.height/a.width:300,fit:'contain',opacity:t.watermarkOpacity});}
   if(s.kind==='original'&&[0,6].includes(s.templateIndex))add({id:'custom-cover',kind:'text',text:s.templateIndex===0?(t.course||'Welcome'):'Thank you',x:180,y:420,w:1560,h:250,size:60,color,font:st.font,align:'center',lineHeight:1.2,editable:true});
  }
 }
 const header=t.headerText??(t.chapter||t.subject||t.course);
 if(header&&((s.kind==='teaching')||[2,3,4,5].includes(s.templateIndex))){
  const height=t.mode==='original'?115:t.headerHeight;
  if(height>0){const size=t.headerFontSize||st.titleSize;const home=t.mode==='original'&&s.templateIndex===5;add({id:'heading',kind:'text',text:header,x:home?560:80,y:Math.max(6,(height-size*2*1.1)/2),w:home?980:1460,h:Math.max(size*2*1.1,height-12),size,font:st.font,bold:true,color:headerTextColour(t,s.templateIndex),align:t.headerAlign||'left',lineHeight:1.1,editable:true});}
 }
 if(s.kind==='original'){
  if(s.image)add({id:'content-image',kind:'image',src:p.assets[s.image]?.data,x:0,y:0,w:1920,h:1080,fit:'contain'});
 }else{
  const g=contentGeometry(p,s);
  if(s.continuation)add({id:'continuation',kind:'text',text:s.continuation,x:g.x,y:g.y-36,w:g.w,h:30,size:12,font:st.font,color,lineHeight:1.1});
  let y=g.y;
  if(s.layout==='theory'&&s.theory){const theory=theoryLayout(p,s);theory.elements.forEach(add);warnings.push(...theory.warnings);}
  else if(s.layout==='table'&&s.blocks[0]?.rows){const rows=s.blocks[0].rows;const cols=Math.max(...rows.map(r=>r.length));const heights=rows.map(row=>Math.max(...row.map(cell=>wrap(cell,g.w/cols-32,st.size,st.font,st.bold,st).length))*st.size*2*st.lineHeight+28);const h=heights.reduce((a,b)=>a+b,0);if(h>g.h)warnings.push('Table row is too tall. Split this row or reduce the font (minimum 20 pt).');add({id:'table',kind:'table',rows,x:g.x,y,w:g.w,h,size:st.size,font:st.font,bold:st.bold,color,fill:t.accent,lineHeight:st.lineHeight,rowHeights:heights});}
  else if(s.layout!=='blank'){
   const rawText=s.text||s.blocks.map(b=>b.kind==='question'?compactQuestion(b.text):b.text).join('\n\n');const text=s.layout==='mcq'?joinQuestionNumber(rawText):rawText;let lines=text.split('\n');const optionStart=lines.findIndex(l=>optionLine.test(l));const optLines=lines.slice(optionStart);const columns=optionStart>=0&&s.layout==='mcq'&&s.optionsMode!=='vertical'&&optLines.filter(l=>optionLine.test(l)).length===4&&optLines.length===4&&(s.optionsMode==='columns'||optLines.every((l,i)=>wrap(orderedOption(s.edits['option-'+i]??l,st.questionLanguageOrder),(g.w-50)/2,st.optionSize,st.font,st.bold,st).length<=(s.optionsMode==='adaptive'?1:2)));
   const size=['title','section'].includes(s.layout)?st.titleSize:st.size;const questionGap=questionOptionsGap(st),optionGap=Math.max(0,Math.min(64,st.optionGap??8));
   const optionMetrics=(text:string,width:number)=>{const count=wrap(text,width,st.optionSize,st.font,st.bold,st).length;const lineHeight=count===1?Math.min(st.lineHeight,1.2):Math.max(1.35,st.lineHeight);return{h:count*st.optionSize*2*lineHeight,lineHeight};};
   const putText=(id:string,text:string,x:number,y:number,w:number,h:number,size:number,bold=false,lineHeight=st.lineHeight)=>add({id,kind:'text',text,x,y,w,h,size,font:st.font,bold:bold||st.bold,color:['title','section'].includes(s.layout)&&st.headingColor?readableColour(st.headingColor,t.mode==='original'?(t.variant==='dark'?'#191b1c':'#ffffff'):t.background):color,align:st.align,lineHeight,editable:true});
   if(columns){const q=orderedQuestion(s.edits.question??lines.slice(0,optionStart).join('\n'),st.questionLanguageOrder);const qh=wrap(q,g.w,size,st.font,st.bold,st).length*size*2*st.lineHeight;putText('question',q,g.x,y,g.w,qh,size);y+=qh+questionGap;const ow=(g.w-50)/2;let rowY=y;for(let r=0;r<2;r++){const row=optLines.slice(r*2,r*2+2).map((text,c)=>{const id=`option-${r*2+c}`,value=orderedOption(s.edits[id]??text,st.questionLanguageOrder);return{id,text:value,...optionMetrics(value,ow)};});for(const [c,option] of row.entries())putText(option.id,option.text,g.x+c*(ow+50),rowY,ow,option.h,st.optionSize,false,option.lineHeight);rowY+=Math.max(...row.map(option=>option.h))+optionGap;}if(rowY-optionGap>g.y+g.h)warnings.push('Options exceed available height. Reflow / split this slide.');}
   else if(optionStart>=0&&s.layout==='mcq'){
    const q=orderedQuestion(s.edits.question??lines.slice(0,optionStart).join('\n'),st.questionLanguageOrder);const qh=wrap(q,g.w,size,st.font,st.bold,st).length*size*2*st.lineHeight;putText('question',q,g.x,y,g.w,qh,size);y+=qh+questionGap;
    const groups:string[]=[];for(const line of optLines){if(optionLine.test(line)||!groups.length)groups.push(line);else groups[groups.length-1]+='\n'+line;}
    groups.forEach((option,i)=>{const id='option-'+i,value=orderedOption(s.edits[id]??option,st.questionLanguageOrder),metrics=optionMetrics(value,g.w);putText(id,value,g.x,y,g.w,metrics.h,st.optionSize,false,metrics.lineHeight);y+=metrics.h+optionGap;});
    if(y-optionGap>g.y+g.h)warnings.push('Options exceed available height. Reflow / split this slide.');
   }
   else {
    const hasEquation=lines.some(l=>/^\s*\$\$?.+\$\$?\s*$/.test(l));
    if(hasEquation){for(let i=0;i<lines.length;i++){const l=lines[i],eq=/^\s*\$\$?(.+?)\$\$?\s*$/.exec(l);const h=eq?size*4:wrap(l,g.w,size,st.font,st.bold,st).length*size*2*st.lineHeight;add({id:'line-'+i,kind:eq?'equation':'text',text:eq?eq[1]:l,x:g.x,y,w:g.w,h,size,font:st.font,color,lineHeight:st.lineHeight,editable:true});y+=h+st.paragraphGap;}if(y>g.y+g.h)warnings.push('Content exceeds available height. Reflow / split this slide.');}
    else putText('body',st.bullets?lines.map(l=>l.trim()?'• '+l:l).join('\n'):text,g.x,y,g.w,g.h,size,['title','section'].includes(s.layout));
   }
  }
  if(s.image){const x=s.layout==='image'?g.x+g.w+40:g.x;add({id:'content-image',kind:'image',src:p.assets[s.image]?.data,x,y:g.y,w:s.layout==='image'?620:g.w,h:g.h,fit:'contain'});}
  const footer=[t.footer,t.teacher,t.pageNumbers?String(page+1):''].filter(Boolean).join('  ·  ');if(footer)add({id:'footer',kind:'text',text:footer,x:80,y:1022,w:1760,h:35,size:11,font:st.font,color,align:'right',lineHeight:1.1});
 }
 for(const layer of s.images||[]){const asset=p.assets[layer.assetId],frame=normalizeImage(layer.placement);elements.push({id:layer.id,kind:'image',src:asset?.data,...frame,imageCrop:frame.crop,imageSize:asset?[asset.width,asset.height]:undefined});}
 for(const box of s.textBoxes||[]){const e=textBoxElement(p,s,box);elements.push(e);if(e.lines!.length*box.size*2*box.lineHeight>e.h+2)warnings.push('Text box overflows. Enlarge the box or reduce its font size.');}
 const timer=slideTimer(p,s);if(timer)elements.push({id:'analog-timer',kind:'timer',timer,x:timer.x,y:timer.y,w:timer.size,h:timer.size});
 for(const e of elements)if(e.kind==='image'&&!e.src)warnings.push(`Missing image: ${e.id}. Upload it again or remove its layer.`);
 if(st.color&&contrast(st.color,t.mode==='custom'?t.background:t.variant==='dark'?'#191b1c':'#ffffff')<3)warnings.push('Low text contrast. Reset text colour or choose a lighter/darker colour.');
 return{id:s.id,elements:orderedElements(elements,s.layerOrder),warnings:[...new Set(warnings)],background:t.mode==='original'?(s.templateIndex===1?'#ffffff':t.variant==='dark'?'#191b1c':'#ffffff'):t.background,notes:s.notes,name:s.name};
}
function contrast(a:string,b:string){const lum=(c:string)=>{const rgb=c.replace('#','').match(/.{2}/g)?.map(v=>parseInt(v,16)/255)||[0,0,0];const x=rgb.map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return x[0]*.2126+x[1]*.7152+x[2]*.0722;};return(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);}

