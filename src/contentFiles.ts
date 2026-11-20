import JSZip from 'jszip';
import {MAX_PDF_TEXT} from './pdfLimits';
import {DOMParser,type Element as XmlElement,type Document as XmlDocument,type Node as XmlNode} from '@xmldom/xmldom';
import {jsonContent,csvContent} from './structuredContent';
export const contentExtensions=['docx','doc','pptx','ppt','pdf','txt','text','md','markdown','csv','tsv','rtf','html','htm','odt','odp','json'];
export type ExtractedFile={name:string;text:string;warnings:string[];pages?:number};
export type Progress=(message:string)=>void;
const MAX_TEXT=1000000,MAX_FILE=25*1024*1024;
const children=(n:XmlNode)=>Array.from(n.childNodes||[]).filter(v=>v.nodeType===1) as XmlElement[];
const all=(n:XmlDocument|XmlElement,tag:string)=>Array.from(n.getElementsByTagNameNS('*',tag));
const attr=(e:XmlElement|undefined,name:string)=>e?.getAttribute(name)||e?.getAttribute('w:'+name)||e?.getAttribute('r:'+name)||'';
function xml(text:string){if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Document XML contains unsupported entities.');return new DOMParser({onError:(level,message)=>{if(level!=='warning')throw Error('Invalid document XML: '+message);}}).parseFromString(text,'application/xml');}
const clean=(text:string)=>text.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{4,}/g,'\n\n\n').trim();
export function decodeText(bytes:Uint8Array){if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(bytes);if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be').decode(bytes);return new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\ufeff/,'');}
export async function officeZip(bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let total=0,entries=0;
 for(let i=0;i+46<bytes.length;i++)if(view.getUint32(i,true)===0x02014b50){total+=view.getUint32(i+24,true);entries++;i+=45+view.getUint16(i+28,true)+view.getUint16(i+30,true)+view.getUint16(i+32,true);}
 if(total>150*1024*1024||entries>10000)throw Error('Document exceeds the extraction size limit. Split it into smaller files.');
 return JSZip.loadAsync(bytes,{checkCRC32:false});
}
async function readXML(zip:JSZip,path:string){const f=zip.file(path);if(!f)throw Error('Missing document part: '+path);const text=await f.async('string');if(text.length>15*1024*1024)throw Error('A document part is too large.');return xml(text);}
function paragraphText(p:XmlElement,tags:string[]=['t']){let out='';const walk=(n:XmlElement)=>{if(['del','instrText','sdtPr'].includes(n.localName||''))return;if(n.localName==='r'&&all(n,'vanish').length)return;if(tags.includes(n.localName||'')){out+=n.textContent||'';return;}if(n.localName==='tab'){out+='\t';return;}if(['br','cr','line-break'].includes(n.localName||'')){out+='\n';return;}for(const child of children(n))walk(child);};walk(p);return out;}
async function docxText(zip:JSZip){
 const doc=await readXML(zip,'word/document.xml'),body=all(doc,'body')[0];if(!body)throw Error('Word document has no body.');
 const counters=new Map<string,number>(),numbering=zip.file('word/numbering.xml')?await readXML(zip,'word/numbering.xml'):undefined;
 function paragraph(p:XmlElement){const text=paragraphText(p);if(!text.trim())return'';const style=attr(all(p,'pStyle')[0],'val');if(/^(?:heading|title)/i.test(style))return'#'.repeat(Math.min(6,Number(style.match(/\d+/)?.[0]||1)))+' '+text;
  const numPr=all(p,'numPr')[0];if(numPr&&numbering){const numId=attr(all(numPr,'numId')[0],'val'),level=attr(all(numPr,'ilvl')[0],'val')||'0';const num=all(numbering,'num').find(n=>attr(n,'numId')===numId),abstractId=num?attr(all(num,'abstractNumId')[0],'val'):'';const abstract=all(numbering,'abstractNum').find(n=>attr(n,'abstractNumId')===abstractId),lvl=abstract?all(abstract,'lvl').find(n=>attr(n,'ilvl')===level):undefined;const format=lvl?attr(all(lvl,'numFmt')[0],'val'):'bullet',start=Number(lvl?attr(all(lvl,'start')[0],'val')||1:1),key=numId+'|'+level,value=(counters.get(key)??start-1)+1;counters.set(key,value);const label=format==='upperLetter'?String.fromCharCode(64+((value-1)%26)+1):format==='lowerLetter'?String.fromCharCode(96+((value-1)%26)+1):String(value);const pattern=lvl?attr(all(lvl,'lvlText')[0],'val'):'';return(format==='bullet'?'•':(pattern||'%1.').replace(/%\d+/g,label))+' '+text;}
  return text;
 }
 const parts:string[]=[];for(const el of children(body)){if(el.localName==='p')parts.push(paragraph(el));else if(el.localName==='tbl')parts.push(all(el,'tr').map(row=>children(row).filter(c=>c.localName==='tc').map(cell=>all(cell,'p').map(p=>paragraphText(p)).join(' ')).join('\t')).join('\n'));else if(el.localName==='sdt')parts.push(all(el,'p').map(paragraph).join('\n\n'));}
 return parts.join('\n\n');
}
function relTarget(base:string,target:string){const parts=(base.slice(0,base.lastIndexOf('/')+1)+target).split('/'),out:string[]=[];for(const p of parts){if(p==='..')out.pop();else if(p&&p!=='.')out.push(p);}return out.join('/');}
export type PictureReader=(bytes:Uint8Array,name:string)=>Promise<string>;
export async function pptxText(zip:JSZip,ocr?:PictureReader,progress:Progress=()=>{}){
 const pres=await readXML(zip,'ppt/presentation.xml'),rels=await readXML(zip,'ppt/_rels/presentation.xml.rels'),map=new Map(all(rels,'Relationship').filter(r=>attr(r,'TargetMode')!=='External').map(r=>[attr(r,'Id'),relTarget('ppt/presentation.xml',attr(r,'Target'))]));
 const pages:string[]=[],empty:number[]=[];
 for(const [index,id] of all(pres,'sldId').entries()){
  const target=map.get(id.getAttribute('r:id')||'');if(!target)throw Error('Presentation has a missing slide relationship.');const doc=await readXML(zip,target);const parts:{text:string;y:number;x:number}[]=[],answers:string[]=[];
  for(const shape of [...all(doc,'sp'),...all(doc,'graphicFrame')]){
   const name=attr(all(shape,'cNvPr')[0],'name'),paragraphs=all(shape,'p'),text=paragraphs.map(p=>paragraphText(p)).filter(Boolean).join('\n');if(!text.trim())continue;
   if(name==='ClassSlide Answer Reveal'){const label=text.match(/^\s*([A-H][).:])/i)?.[1];if(label)answers.push('Answer: '+label);continue;}
   const ph=all(shape,'ph')[0],type=attr(ph,'type');if(['ftr','dt','sldNum'].includes(type))continue;
   const off=all(shape,'off')[0],heading=['title','ctrTitle'].includes(type);const table=all(shape,'tbl')[0];const value=table?all(table,'tr').map(row=>children(row).filter(c=>c.localName==='tc').map(cell=>all(cell,'p').map(p=>paragraphText(p)).join(' ')).join('\t')).join('\n'):text;
   parts.push({text:(heading?'# ':'')+value,y:Number(attr(off,'y')||0),x:Number(attr(off,'x')||0)});
  }
  if(ocr){
   progress(`Reading images on slide ${index+1} / ${all(pres,'sldId').length}…`);
   const relFile=target.slice(0,target.lastIndexOf('/')+1)+'_rels/'+target.slice(target.lastIndexOf('/')+1)+'.rels';
   const relationships=zip.file(relFile)?all(await readXML(zip,relFile),'Relationship'):[];
   const pictures=[...all(doc,'pic'),...all(doc,'bg')];const seen=new Set<string>();
   for(const pic of pictures){const blip=all(pic,'blip')[0],embed=blip?.getAttribute('r:embed'),rel=relationships.find(r=>attr(r,'Id')===embed&&attr(r,'TargetMode')!=='External');if(!rel)continue;const file=relTarget(target,attr(rel,'Target'));if(seen.has(file))continue;seen.add(file);const entry=zip.file(file);if(!entry)continue;const image=await entry.async('uint8array');const recognized=await ocr(image,file);if(recognized.trim()){const off=all(pic,'off')[0];parts.push({text:recognized,y:Number(attr(off,'y')||0),x:Number(attr(off,'x')||0)});}}
  }
  parts.sort((a,b)=>Math.abs(a.y-b.y)<100000?a.x-b.x:a.y-b.y);const unique=[...new Map(parts.map(p=>[p.text.replace(/\s+/g,' ').trim(),p.text])).values()];const text=unique.join('\n\n');if(!text.trim())empty.push(index+1);else pages.push(text+(answers.length?'\n'+[...new Set(answers)].join('\n'):''));
  if(pages.reduce((sum,p)=>sum+p.length,0)>1000000)throw Error('Extracted content exceeds 1,000,000 characters. Import fewer slides.');
 }
 return{text:pages.join('\n\n---\n\n'),pages:all(pres,'sldId').length,warnings:empty.length?[ocr?`Slides ${empty.join(', ')} produced no readable text even with OCR.`:`Slides ${empty.join(', ')} contain no editable text (artwork/images). Their images were not converted to text.`]:[]};
}
export function rtfText(input:string){
 const stack:{skip:boolean;uc:number}[]=[];let state={skip:false,uc:1},out='',fallback=0;
 for(let i=0;i<input.length;i++){
  const c=input[i];if(c==='{'){stack.push({...state});continue;}if(c==='}'){state=stack.pop()||{skip:false,uc:1};continue;}
  if(c!=='\\'){if(c!=='\n'&&c!=='\r'){if(fallback)fallback--;else if(!state.skip)out+=c;}continue;}
  const next=input[++i];if(['\\','{','}'].includes(next)){if(fallback)fallback--;else if(!state.skip)out+=next;continue;}
  if(next==='*'){state.skip=true;continue;}if(next==="'"){const hex=input.slice(i+1,i+3);i+=2;if(fallback)fallback--;else if(!state.skip)out+=new TextDecoder('windows-1252').decode(new Uint8Array([parseInt(hex,16)]));continue;}
  if(next==='~'){if(!state.skip)out+=' ';continue;}const match=/^([a-z]+)(-?\d+)? ?/i.exec(input.slice(i));if(!match)continue;i+=match[0].length-1;const word=match[1],value=Number(match[2]||0);
  if(['fonttbl','colortbl','stylesheet','info','pict','object','header','footer','fldinst'].includes(word))state.skip=true;
  if(word==='uc')state.uc=value;if(word==='bin'){i+=Math.max(0,value);continue;}
  if(state.skip)continue;if(word==='u'){out+=String.fromCharCode(value<0?value+65536:value);fallback=state.uc;}else if(['par','line','row'].includes(word))out+='\n';else if(['tab','cell'].includes(word))out+='\t';else if(word==='bullet')out+='•';
 }
 return out;
}
export async function extractContent(bytes:Uint8Array,name:string,progress:Progress=()=>{},readers?:{office?:(bytes:Uint8Array,format:string)=>Promise<string>;pdf?:(bytes:Uint8Array,progress:Progress)=>Promise<Omit<ExtractedFile,'name'>>}):Promise<ExtractedFile>{
 if(bytes.length>MAX_FILE)throw Error('Use files up to 25 MB each. Split larger documents first.');if(!bytes.length)throw Error('This file is empty.');const ext=name.split('.').pop()!.toLowerCase();if(!contentExtensions.includes(ext))throw Error('Unsupported file. Use Word, PDF, PowerPoint, TXT, Markdown, CSV/TSV, RTF, HTML, ODT/ODP or JSON.');progress('Reading '+name+'…');
 let result:ExtractedFile={name,text:'',warnings:[]};
 if(ext==='pdf'){const reader=readers?.pdf||(await import('./pdfContent')).extractPdf;result={...result,...await reader(bytes,progress)};}
 else if(['docx','pptx','odt','odp'].includes(ext)){
  const zip=await officeZip(bytes);if(ext==='docx')result.text=await docxText(zip);else if(ext==='pptx')result={...result,...await pptxText(zip)};
  else{const doc=await readXML(zip,'content.xml');result.text=all(doc,'body').flatMap(body=>[...all(body,'h'),...all(body,'p')].sort((a,b)=>{const nodes=all(body,'*');return nodes.indexOf(a)-nodes.indexOf(b);}).map(p=>(p.localName==='h'?'# ':'')+(p.textContent||''))).join('\n\n');}
 }else if(['doc','ppt'].includes(ext)){
  const prefix=new TextDecoder().decode(bytes.slice(0,80)).trim();if(prefix.startsWith('{\\rtf'))result.text=rtfText(new TextDecoder('windows-1252').decode(bytes));else if(/^<(?:!DOCTYPE|html)/i.test(prefix))result.text=htmlText(decodeText(bytes));else{const reader=readers?.office||(await import('./officeContent')).extractLegacyOffice;result.text=await reader(bytes,ext);result.warnings.push('Legacy Office text extracted. Review reading order and automatic list labels before formatting.');}
 }else if(ext==='rtf')result.text=rtfText(new TextDecoder('windows-1252').decode(bytes));
 else if(['html','htm'].includes(ext))result.text=htmlText(decodeText(bytes));
 else if(ext==='json')result.text=jsonContent(decodeText(bytes));
 else if(ext==='csv')result.text=csvContent(decodeText(bytes));
 else result.text=decodeText(bytes);
 result.text=clean(result.text);if(result.text.length>(ext==='pdf'?MAX_PDF_TEXT:MAX_TEXT))throw Error(`Extracted content exceeds ${ext==='pdf'?'5,000,000':'1,000,000'} characters. Import a smaller section.`);if(!result.text)throw Error(result.warnings.join(' ')||'No readable text found. This may be a scanned/image-only or protected document. Use a text-searchable copy or OCR first.');return result;
}
export function htmlText(input:string){const full=/<html[\s>]/i.test(input)?input:'<html><body>'+input.replace(/<!doctype[^>]*>/gi,'')+'</body></html>';const doc=new DOMParser().parseFromString(full,'text/html');for(const tag of ['head','script','style','noscript','iframe'])for(const el of all(doc,tag))el.parentNode?.removeChild(el);let out='';const walk=(n:XmlNode)=>{if(n.nodeType===3){out+=n.nodeValue;return;}if(n.nodeType!==1&&n.nodeType!==9)return;const tag=(n as XmlElement).localName?.toLowerCase()||'';if(/^h[1-6]$/.test(tag))out+='\n\n'+'#'.repeat(Number(tag[1]))+' ';if(tag==='li')out+='\n• ';if(tag==='br')out+='\n';for(const c of Array.from(n.childNodes||[]))walk(c);if(['p','div','section','article','tr','li'].includes(tag)||/^h[1-6]$/.test(tag))out+='\n\n';if(['td','th'].includes(tag))out+='\t';};walk(doc);return clean(out);}
