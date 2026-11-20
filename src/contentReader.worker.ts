import {extractContent} from './contentFiles';
self.onmessage=async(event:MessageEvent<{bytes:ArrayBuffer;name:string}>)=>{try{const result=await extractContent(new Uint8Array(event.data.bytes),event.data.name,message=>self.postMessage({type:'progress',message}));self.postMessage({type:'result',result});}catch(e){self.postMessage({type:'error',message:e instanceof Error?e.message:String(e)});}};
