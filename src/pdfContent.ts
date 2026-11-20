import type {ExtractedFile,Progress} from './contentFiles';
import {MAX_PDF_PAGES,MAX_PDF_TEXT} from './pdfLimits';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
export type PdfTextItem={str:string;transform:number[];width:number;height:number;hasEOL?:boolean};
export function pdfLines(items:PdfTextItem[]){
 // Use PDF text-stream order, retaining deliberate line endings and visible word gaps.
 const lines:string[]=[];let line='',previous:PdfTextItem|undefined;
 for(const item of items){if(!item.str){if(item.hasEOL&&line){lines.push(line);line='';previous=undefined;}continue;}
  if(previous){const dy=Math.abs(item.transform[5]-previous.transform[5]),newLine=dy>Math.max(2,Math.min(item.height||10,previous.height||10)*.45);if(newLine){if(line)lines.push(line);line='';}else{const gap=item.transform[4]-(previous.transform[4]+previous.width);if(gap>Math.max(1,previous.height*.12)&&line&&!/\s$/.test(line)&&!/^\s/.test(item.str))line+=' ';}}
  line+=item.str;previous=item;if(item.hasEOL){lines.push(line);line='';previous=undefined;}
 }
 if(line)lines.push(line);return lines.join('\n');
}
export async function extractPdf(bytes:Uint8Array,progress:Progress=()=>{},assets?:{workerSrc:string;base:string}):Promise<Omit<ExtractedFile,'name'>>{
 const pdf=await import('pdfjs-dist/legacy/build/pdf.mjs');pdf.GlobalWorkerOptions.workerSrc=assets?.workerSrc||workerUrl;const base=assets?.base||'/readers/pdfjs/';
 const loading=pdf.getDocument({data:bytes,useSystemFonts:true,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/'});
 try{const doc=await loading.promise;if(doc.numPages>MAX_PDF_PAGES)throw Error(`PDF supports up to ${MAX_PDF_PAGES} pages per file. Split this PDF first.`);const pages:string[]=[],empty:number[]=[];let total=0;
  for(let page=1;page<=doc.numPages;page++){progress(`Extracting PDF page ${page} / ${doc.numPages}…`);const p=await doc.getPage(page);try{const content=await p.getTextContent(),text=pdfLines(content.items.filter(item=>'str'in item) as PdfTextItem[]);if(!text.trim())empty.push(page);else pages.push(text);total+=text.length;if(total>MAX_PDF_TEXT)throw Error('PDF text exceeds 5,000,000 characters. Import a smaller section.');}finally{p.cleanup();}}
  return{text:pages.join('\n\n'),pages:doc.numPages,warnings:[...(empty.length?[`Pages ${empty.join(', ')} have no selectable text; scanned images need OCR. These pages were not extracted.`]:[]),'PDF reading order may need correction for columns, equations or unusual fonts. Review extracted content.']};
 }catch(e){if((e as Error).name==='PasswordException')throw Error('This PDF is password protected. Upload an unlocked copy.');throw e;}finally{await loading.destroy();}
}
