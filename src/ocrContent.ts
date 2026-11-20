import {officeZip,pptxText,type ExtractedFile,type Progress} from './contentFiles';
import {createOcrReader,imageCanvas,checkAbort,needsOcr,type OcrSettings} from './ocr';
import {pdfLines,type PdfTextItem} from './pdfContent';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import {legacyPictures} from './pptPictures';
import {MAX_PDF_PAGES,MAX_PDF_TEXT} from './pdfLimits';
export const imageExtensions=['png','jpg','jpeg','webp','bmp'];
export function ocrSupported(name:string){return ['pdf','pptx','ppt',...imageExtensions].includes(name.split('.').pop()!.toLowerCase());}
export async function extractWithOcr(bytes:Uint8Array,name:string,settings:OcrSettings,signal:AbortSignal,progress:Progress=()=>{}):Promise<ExtractedFile>{
 if(bytes.length>25*1024*1024)throw Error('Use files up to 25 MB each.');checkAbort(signal);
 const reader=createOcrReader(settings,signal,progress),warnings:string[]=['OCR can misread letters, numbers and option labels. Review the extracted text and answers before making slides.'];let imageCount=0;
 const recognize=async(data:Uint8Array,picture:string)=>{checkAbort(signal);if(++imageCount>150)throw Error('More than 150 images. Import a smaller presentation.');let canvas:HTMLCanvasElement|undefined;try{canvas=await imageCanvas(data,picture);const r=await reader.recognize(canvas);if(r.confidence<60)warnings.push(`${picture.split('/').pop()}: low OCR confidence; check this text carefully.`);return r.text;}catch(e){checkAbort(signal);warnings.push(`${picture.split('/').pop()}: ${e instanceof Error?e.message:'Image could not be read'}`);return'';}finally{if(canvas){canvas.width=0;canvas.height=0;}}};
 try{
  const ext=name.split('.').pop()!.toLowerCase();let result:Omit<ExtractedFile,'name'>;
  if(ext==='pdf')result=await pdfOcr(bytes,settings,signal,progress,reader.recognize);
  else if(ext==='pptx')result=await pptxText(await officeZip(bytes),recognize,progress);
  else if(ext==='ppt'){
   const {extractLegacyOffice}=await import('./officeContent');const text=await extractLegacyOffice(bytes,'ppt');const pictures=await legacyPictures(bytes);const texts:string[]=[];for(const [i,pic] of pictures.entries()){progress(`OCR · PowerPoint image ${i+1} / ${pictures.length}…`);texts.push(await recognize(pic.bytes,pic.name));}result={text:[text,...texts].filter(t=>t.trim()).join('\n\n---\n\n'),warnings:['Legacy PPT images are extracted in embedded-image order after editable text. Save as PPTX for slide-by-slide image order.']};
  }else result={text:await recognize(bytes,name),warnings:[]};
  checkAbort(signal);if(!result.text.trim())throw Error('OCR found no readable text. Try a sharper, upright scan and select the correct language.');const maxText=ext==='pdf'?MAX_PDF_TEXT:1000000;if(result.text.length>maxText)throw Error(`OCR text exceeds ${ext==='pdf'?'5,000,000':'1,000,000'} characters. Import a smaller section.`);return{name,...result,warnings:[...result.warnings,...warnings]};
 }finally{reader.close();}
}
export async function pdfOcr(bytes:Uint8Array,settings:OcrSettings,signal:AbortSignal,progress:Progress,recognize:(image:HTMLCanvasElement)=>Promise<{text:string;confidence:number}>,assets?:{workerSrc:string;base:string},canvasFactory?:()=>HTMLCanvasElement):Promise<Omit<ExtractedFile,'name'>>{
 const pdf=await import('pdfjs-dist/legacy/build/pdf.mjs');pdf.GlobalWorkerOptions.workerSrc=assets?.workerSrc||workerUrl;const base=assets?.base||'/readers/pdfjs/';const loading=pdf.getDocument({data:bytes,useSystemFonts:true,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/'});const abort=()=>{void loading.destroy();};signal.addEventListener('abort',abort,{once:true});
 try{const doc=await loading.promise;if(doc.numPages>MAX_PDF_PAGES)throw Error(`OCR supports up to ${MAX_PDF_PAGES} PDF pages per file. Split this PDF first.`);const texts:string[]=[],warnings:string[]=[];let total=0;
  for(let i=1;i<=doc.numPages;i++){checkAbort(signal);progress(`PDF page ${i} / ${doc.numPages}…`);const page=await doc.getPage(i);try{const content=await page.getTextContent();let text=pdfLines(content.items.filter(item=>'str'in item) as PdfTextItem[]);
   if(needsOcr(text,settings.mode)){const natural=page.getViewport({scale:1});const scale=Math.min(3,2500/Math.max(natural.width,natural.height));const viewport=page.getViewport({scale});const canvas=canvasFactory?canvasFactory():document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);try{await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;checkAbort(signal);const read=await recognize(canvas);if(read.text.trim())text=read.text;else warnings.push(`Page ${i}: OCR found no text${text.trim()?'; selectable text retained':''}.`);if(read.confidence<60)warnings.push(`Page ${i}: low OCR confidence; review numbers and option labels.`);}finally{canvas.width=0;canvas.height=0;}}
   if(text.trim())texts.push(text);total+=text.length;if(total>MAX_PDF_TEXT)throw Error('OCR text exceeds 5,000,000 characters. Import fewer pages.');
  }finally{page.cleanup();}}
  return{text:texts.join('\n\n---\n\n'),pages:doc.numPages,warnings};
 }catch(e){checkAbort(signal);if((e as Error).name==='PasswordException')throw Error('This PDF is password protected. Upload an unlocked copy.');throw e;}finally{signal.removeEventListener('abort',abort);await loading.destroy();}
}
