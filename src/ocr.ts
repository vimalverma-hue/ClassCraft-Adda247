import {createWorker,type Worker} from 'tesseract.js';
import type {Progress} from './contentFiles';
export type OcrLanguage='hin+eng'|'eng'|'hin';
export type OcrSettings={mode:'off'|'auto'|'full';language:OcrLanguage};
export const defaultOcr:OcrSettings={mode:'auto',language:'hin+eng'};
export function abortError(){return new DOMException('Extraction cancelled','AbortError');}
export function checkAbort(signal:AbortSignal){if(signal.aborted)throw abortError();}
function cancellable<T>(promise:Promise<T>,signal:AbortSignal){return new Promise<T>((resolve,reject)=>{const stop=()=>reject(abortError());signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',stop));});}
export function needsOcr(text:string,mode:OcrSettings['mode']){return mode==='full'||(mode==='auto'&&text.replace(/\s/g,'').length<40);}
export function createOcrReader(settings:OcrSettings,signal:AbortSignal,progress:Progress){
 let worker:Worker|undefined,ready:Promise<Worker>|undefined,closed=false;
 const close=()=>{closed=true;void worker?.terminate();worker=undefined;};signal.addEventListener('abort',close,{once:true});
 async function recognize(image:Blob|Uint8Array|HTMLCanvasElement){
  checkAbort(signal);if(closed)throw abortError();
  ready??=createWorker(settings.language,1,{workerPath:'/readers/ocr/worker.min.js',corePath:'/readers/ocr',langPath:'/readers/ocr/lang',workerBlobURL:false,logger:m=>progress(`OCR · ${m.status}${typeof m.progress==='number'?' '+Math.round(m.progress*100)+'%':''}`)}).then(w=>{if(closed){void w.terminate();throw abortError();}worker=w;return w;});
  const w=await cancellable(ready,signal);checkAbort(signal);const result=await cancellable(w.recognize(image as Parameters<Worker['recognize']>[0]),signal);checkAbort(signal);
  return{text:result.data.text.trim(),confidence:result.data.confidence};
 }
 return{recognize,close:()=>{signal.removeEventListener('abort',close);close();}};
}
export async function imageCanvas(bytes:Uint8Array,name:string){
 const ext=name.split('.').pop()?.toLowerCase();if(!['png','jpg','jpeg','webp','bmp','gif','tif','tiff'].includes(ext||''))throw Error(`OCR cannot read ${name.split('/').pop()}. Convert this picture to PNG/JPG first.`);
 const image=await createImageBitmap(new Blob([bytes as BlobPart]));try{
  if(image.width*image.height>40000000)throw Error('Picture exceeds 40 megapixels. Resize it before OCR.');
  const scale=Math.min(2,2400/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d')!;context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return canvas;
 }finally{image.close();}
}
