export type TheorySection={title:string;items:string[]};
const bullet=/^\s*(?:[-*•▪◦]\s+|\d+[.)]\s+)/;
const ended=(text:string)=>/[.!?।॥][”’"')\]]*$/.test(text.trim());
const words=(text:string)=>text.trim().split(/\s+/).length;
const clean=(text:string)=>text.replace(/\*\*(.*?)\*\*/g,'$1').replace(/__(.*?)__/g,'$1');
const language=(text:string)=>/[\u0900-\u097f]/.test(text)?'hi':/[A-Za-z]/.test(text)?'en':'';
export function pairedTheoryText(text:string):{primary:string;secondary?:string}{
 const hi=/[\u0900-\u097f]/,en=/[A-Za-z]/;
 for(const m of text.matchAll(/\n+|\s+\/\s+/g)){const a=text.slice(0,m.index).trim(),b=text.slice(m.index!+m[0].length).trim();if(hi.test(a)&&!hi.test(b)&&en.test(b))return{primary:a,secondary:b};if(hi.test(b)&&!hi.test(a)&&en.test(a))return{primary:b,secondary:a};}
 return{primary:text.trim()};
}
const titleKey=(text:string)=>clean(text).replace(/\s*(?:\(?cont(?:inued|d)?\.?\)?|\(?जारी\)?)\s*$/i,'').replace(/[\s:：]+/g,' ').trim().toLowerCase();
const shortTitle=(text:string)=>text.length<=90&&words(text)<=10&&!ended(text)&&!bullet.test(text)&&!/[\t$]/.test(text)&&/[A-Za-z\u0900-\u097f]/.test(text)&&!/(?:\b(?:a|an|the|and|of|in|on|at|for|with|to|is|are|was|were|has|have)|(?:का|के|की|में|से|पर|और|तथा|लिए|को))\s*$/i.test(text);
const bodyLike=(text:string)=>bullet.test(text)||words(text)>=7||(words(text)>=4&&ended(text));

/** Treat OCR line/page boundaries as wrapping; only supported topic headings start sections. */
export function theorySections(text:string,bullets:boolean):TheorySection[]{
 const lines:{text:string;blank:boolean;page:boolean}[]=[];let blank=true,page=true;
 for(const raw of text.replace(/\r\n?/g,'\n').replace(/\f/g,'\n\n---\n\n').split('\n')){
  const value=raw.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
  if(!value){blank=true;continue;}if(/^---+$/.test(value)){blank=true;page=true;continue;}
  lines.push({text:value,blank,page});blank=false;page=false;
 }
 const sections:TheorySection[]=[];let title='',items:string[]=[],paragraph='',lastLanguage='',listed=false;
 const paragraphDone=()=>{if(!paragraph)return;const value=clean(paragraph.trim());
  if(bullets&&!listed&&!pairedTheoryText(value).secondary&&!/^\$/.test(value)&&typeof Intl.Segmenter!=='undefined')items.push(...[...new Intl.Segmenter(language(value)==='hi'?'hi':'en',{granularity:'sentence'}).segment(value)].map(v=>v.segment.trim()).filter(Boolean));
  else items.push(value);paragraph='';lastLanguage='';listed=false;
 };
 const sectionDone=()=>{paragraphDone();if(title||items.length)sections.push({title,items});title='';items=[];};
 const heading=(value:string)=>{paragraphDone();const next=clean(value).replace(/[:：]$/,'');if(titleKey(title)===titleKey(next)&&title)return;
  if(title&&!items.length){title+=language(title)&&language(next)&&language(title)!==language(next)?'\n'+next:' · '+next;return;}
  sectionDone();title=next;
 };
 for(let i=0;i<lines.length;i++){
  const line=lines[i],value=line.text,next=lines[i+1]?.text||'',after=lines[i+2]?.text||'';
  const explicit=/^#{1,6}\s+(.+)$/.exec(value)||/^\*\*(.+)\*\*\s*$/.exec(value);
  if(explicit){heading(explicit[1]);continue;}
  const canStart=(line.blank||line.page)&&(!paragraph||ended(paragraph));
  const bilingualHeading=shortTitle(value)&&shortTitle(next)&&language(value)&&language(next)&&language(value)!==language(next)&&bodyLike(after);
  const plainHeading=shortTitle(value)&&bodyLike(next)&&(!language(next)||language(next)==='hi'||bullet.test(next)||/^[A-Z]/.test(next));
  if((shortTitle(value)&&/[:：]$/.test(value))||(canStart&&(bilingualHeading||plainHeading))){heading(bilingualHeading?value+'\n'+next:value);if(bilingualHeading)i++;continue;}
  if(bullet.test(value)){paragraphDone();paragraph=clean(value.replace(/^\s*[-*•▪◦]\s+/,''));listed=true;lastLanguage=language(paragraph);continue;}
  if(/^\$\$?.+\$\$?$/.test(value)){paragraphDone();items.push(value);continue;}
  const lang=language(value),changingLanguage=!!(lastLanguage&&lang&&lastLanguage!==lang);
  if(paragraph&&((line.blank&&ended(paragraph)&&!changingLanguage)||(changingLanguage&&pairedTheoryText(paragraph).secondary)))paragraphDone();
  if(paragraph&&line.blank&&listed&&bodyLike(value)&&!changingLanguage)paragraphDone();
  paragraph+=(paragraph?(lastLanguage&&lang&&lastLanguage!==lang?'\n':' '):'')+value;lastLanguage=lang||lastLanguage;
 }
 sectionDone();return sections;
}
