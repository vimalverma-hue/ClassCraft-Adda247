import {it,expect,vi} from 'vitest';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {jsPDF} from 'jspdf';
import {createCanvas} from '@napi-rs/canvas';
import {extractPdf} from '../src/pdfContent';
import {pdfOcr} from '../src/ocrContent';
import {extractContent} from '../src/contentFiles';

const assets={workerSrc:pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href,base:path.resolve('node_modules/pdfjs-dist').replaceAll('\\','/')+'/'};
function documentBytes(count:number,scanned=false){
 const pdf=new jsPDF({format:[60,60],compress:true});pdf.setFontSize(8);
 const image=createCanvas(32,32),context=image.getContext('2d');context.fillStyle='white';context.fillRect(0,0,32,32);context.fillStyle='black';context.fillRect(8,8,16,16);const png=image.toBuffer('image/png');
 for(let i=1;i<=count;i++){if(i>1)pdf.addPage();if(scanned)pdf.addImage(new Uint8Array(png),'PNG',5,5,30,30,'scan');else pdf.text([`Page ${i}: Selectable teaching`,'content with enough readable text','to skip automatic OCR.'],5,10);}
 return new Uint8Array(pdf.output('arraybuffer'));
}

it('extracts all 500 pages with OCR off and skips OCR for selectable text in auto mode',async()=>{
 const bytes=documentBytes(500),recognize=vi.fn(),progress=vi.fn();
 const plain=await extractContent(bytes.slice(),'500-pages.pdf',progress,{pdf:(data,report)=>extractPdf(data,report,assets)});
 const auto=await pdfOcr(bytes.slice(),{mode:'auto',language:'eng'},new AbortController().signal,progress,recognize,assets);
 for(const result of [plain,auto]){expect(result.pages).toBe(500);expect(result.text.match(/Selectable teaching/g)).toHaveLength(500);expect(result.text.indexOf('Page 1:')).toBeLessThan(result.text.indexOf('Page 500:'));}
 expect(recognize).not.toHaveBeenCalled();expect(progress).toHaveBeenCalledWith('PDF page 500 / 500…');
},30000);

it('renders 500 scanned pages sequentially, keeps text over the old limit and releases every canvas',async()=>{
 const canvases:ReturnType<typeof createCanvas>[]=[],progress=vi.fn();let running=0,maximum=0,index=0;
 const recognize=vi.fn(async(canvas:HTMLCanvasElement)=>{maximum=Math.max(maximum,++running);expect(canvas.width).toBeGreaterThan(0);expect(canvas.height).toBeGreaterThan(0);await Promise.resolve();running--;return{text:(`Page ${++index}: `+'Teaching content. '.repeat(130)).trim(),confidence:95};});
 const result=await pdfOcr(documentBytes(500,true),{mode:'auto',language:'eng'},new AbortController().signal,progress,recognize,assets,()=>{const canvas=createCanvas(1,1);canvases.push(canvas);return canvas as unknown as HTMLCanvasElement;});
 expect(result.pages).toBe(500);expect(result.text.length).toBeGreaterThan(1000000);expect(result.text).toContain('Page 500:');expect(recognize).toHaveBeenCalledTimes(500);expect(maximum).toBe(1);expect(progress).toHaveBeenCalledWith('PDF page 500 / 500…');
 expect(canvases.every(canvas=>canvas.width===0&&canvas.height===0)).toBe(true);
 await expect(extractContent(new Uint8Array([1]),'large.pdf',()=>{},{pdf:async()=>result})).resolves.toMatchObject({pages:500,text:result.text});
},30000);

it('rejects page 501 before OCR starts and cancels an ongoing large PDF',async()=>{
 const oversized=documentBytes(501),recognize=vi.fn();
 await expect(extractPdf(oversized.slice(),()=>{},assets)).rejects.toThrow('500 pages');
 await expect(pdfOcr(oversized.slice(),{mode:'full',language:'eng'},new AbortController().signal,()=>{},recognize,assets)).rejects.toThrow('500 PDF pages');expect(recognize).not.toHaveBeenCalled();
 const controller=new AbortController(),canvases:ReturnType<typeof createCanvas>[]=[];let count=0;
 await expect(pdfOcr(documentBytes(500,true),{mode:'full',language:'eng'},controller.signal,()=>{},async()=>{if(++count===7)controller.abort();return{text:'A scanned page.',confidence:95};},assets,()=>{const canvas=createCanvas(1,1);canvases.push(canvas);return canvas as unknown as HTMLCanvasElement;})).rejects.toMatchObject({name:'AbortError'});
 expect(count).toBe(7);expect(canvases.every(canvas=>canvas.width===0&&canvas.height===0)).toBe(true);
},30000);
