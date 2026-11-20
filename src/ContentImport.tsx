import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Upload,FileText,X} from 'lucide-react';
import {contentExtensions,type ExtractedFile} from './contentFiles';
import {defaultOcr,type OcrSettings} from './ocr';
const imageExtensions=['png','jpg','jpeg','webp','bmp'];
export function ContentImport({children,onImport}:{children:ReactNode;onImport:(text:string,append:boolean)=>Promise<void>}){
 const input=useRef<HTMLInputElement>(null),worker=useRef<Worker|null>(null),job=useRef(0),abortRead=useRef<(()=>void)|null>(null);
 const[busy,setBusy]=useState(''),[error,setError]=useState(''),[files,setFiles]=useState<ExtractedFile[]>([]),[preview,setPreview]=useState(''),[open,setOpen]=useState(false),[drag,setDrag]=useState(false),[ocr,setOcr]=useState<OcrSettings>(defaultOcr);
 useEffect(()=>()=>{job.current++;abortRead.current?.();worker.current?.terminate();},[]);
 async function read(list:File[]){
  if(!list.length)return;setError('');if(list.length>10||list.reduce((sum,f)=>sum+f.size,0)>75*1024*1024){setError('Import up to 10 files, 75 MB total, and 25 MB per file.');return;}abortRead.current?.();const currentJob=++job.current;setBusy('Opening documents…');
  const extracted:ExtractedFile[]=[];const failed:string[]=[];
  for(const file of list){if(currentJob!==job.current)break;try{
   if(file.size>25*1024*1024)throw Error('File exceeds 25 MB.');const bytes=await file.arrayBuffer();if(currentJob!==job.current)break;
   const ext=file.name.split('.').pop()!.toLowerCase();
   if(ocr.mode!=='off'&&['pdf','pptx','ppt',...imageExtensions].includes(ext)){
    const controller=new AbortController();abortRead.current=()=>controller.abort();const {extractWithOcr}=await import('./ocrContent');if(currentJob!==job.current)controller.abort();
    try{extracted.push(await extractWithOcr(new Uint8Array(bytes),file.name,ocr,controller.signal,message=>{if(currentJob===job.current)setBusy(file.name+' · '+message);}));}finally{if(currentJob===job.current)abortRead.current=null;}continue;
   }
   if(imageExtensions.includes(ext))throw Error('Enable OCR to extract text from images.');
   const result=await new Promise<ExtractedFile>((resolve,reject)=>{const w=new Worker(new URL('./contentReader.worker.ts',import.meta.url),{type:'module'});worker.current=w;let timer:ReturnType<typeof setTimeout>;const finish=()=>{clearTimeout(timer);w.terminate();worker.current=null;abortRead.current=null;};const refreshTimeout=()=>{clearTimeout(timer);timer=setTimeout(()=>{finish();reject(Error('Extraction timed out. Try a smaller document.'));},90000);};refreshTimeout();abortRead.current=()=>{finish();reject(new DOMException('Cancelled','AbortError'));};w.onmessage=e=>{if(e.data.type==='progress'){refreshTimeout();setBusy(file.name+' · '+e.data.message);}else if(e.data.type==='result'){finish();resolve(e.data.result);}else{finish();reject(Error(e.data.message));}};w.onerror=()=>{finish();reject(Error('Document reader failed. Reload the app and try again.'));};w.postMessage({bytes,name:file.name},[bytes]);});extracted.push(result);
  }catch(e){failed.push(file.name+': '+(e instanceof Error?e.message:String(e)));}}
  if(currentJob!==job.current)return;setBusy('');setFiles(extracted);setError(failed.join('\n'));if(extracted.length){setPreview(extracted.map(f=>f.text).join('\n\n---\n\n'));setOpen(true);}
 }
 const cancel=()=>{job.current++;abortRead.current?.();worker.current?.terminate();worker.current=null;setBusy('');};
 async function apply(append:boolean){try{setError('');setBusy('Saving extracted content…');await onImport(preview,append);setOpen(false);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy('');}}
 return <div className={'content-import '+(drag?'file-dragging':'')} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();setDrag(true);}}} onDragLeave={()=>setDrag(false)} onDrop={e=>{if(e.dataTransfer.files.length){e.preventDefault();setDrag(false);void read(Array.from(e.dataTransfer.files));}}} onPaste={e=>{if(e.clipboardData.files.length){e.preventDefault();void read(Array.from(e.clipboardData.files));}}}>
  <div className="ocr-settings"><label>OCR<select aria-label="OCR mode" value={ocr.mode} disabled={!!busy} onChange={e=>setOcr({...ocr,mode:e.target.value as OcrSettings['mode']})}><option value="auto">Auto</option><option value="full">Full</option><option value="off">Off</option></select></label><label>Language<select aria-label="OCR language" value={ocr.language} disabled={!!busy||ocr.mode==='off'} onChange={e=>setOcr({...ocr,language:e.target.value as OcrSettings['language']})}><option value="hin+eng">हिंदी + EN</option><option value="hin">हिंदी</option><option value="eng">English</option></select></label></div>
  <button className="button primary full content-upload-button" onClick={()=>input.current?.click()} disabled={!!busy}><Upload size={15}/>Upload content files</button>

  {children}<input ref={input} hidden type="file" multiple aria-label="Upload teaching content files" accept={[...contentExtensions,...imageExtensions].map(e=>'.'+e).join(',')} onChange={e=>{void read(Array.from(e.target.files||[]));e.target.value='';}}/>
  {error&&!open&&<p className="language-error" role="alert">{error}</p>}
  {open&&<div className="modal-backdrop"><section className="modal wide import-review" role="dialog" aria-modal="true" aria-label="Review extracted content"><div className="modal-heading"><h2><FileText size={18}/> Review extracted content</h2><button className="icon-button" aria-label="Close content import" onClick={()=>setOpen(false)}><X size={18}/></button></div><p>{files.map(f=>f.name+(f.pages?' · '+f.pages+' pages/slides':'')).join(' · ')}</p>{files.flatMap(f=>f.warnings.map(w=><p className="import-warning" key={f.name+w}>{f.name}: {w}</p>))}{error&&<p className="language-error" role="alert">{error}</p>}<textarea aria-label="Extracted teaching content" value={preview} onChange={e=>setPreview(e.target.value)} rows={17}/><div className="modal-actions"><button className="button secondary" onClick={()=>setOpen(false)}>Cancel</button><button className="button secondary" disabled={!preview.trim()} onClick={()=>apply(true)}>Append to content</button><button className="button primary" disabled={!preview.trim()} onClick={()=>apply(false)}>Use as content</button></div></section></div>}
  {busy&&<div className="busy-overlay"><div className="busy-card"><div className="spinner"/><strong role="status">{busy}</strong>{!busy.startsWith('Saving')&&<button className="button secondary" onClick={cancel}>Cancel extraction</button>}</div></div>}
 </div>;
}
