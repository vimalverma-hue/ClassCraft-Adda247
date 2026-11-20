import init,{WasmDocument} from 'office-oxide-wasm/web';
let ready:Promise<unknown>|undefined;
export async function extractLegacyOffice(bytes:Uint8Array,format:string){
 ready??=init({module_or_path:'/readers/office_oxide_bg.wasm'}).catch(e=>{ready=undefined;throw e;});await ready;
 const doc=new WasmDocument(bytes,format);try{return doc.toMarkdown().replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/^## Slide \d+\s*$/gm,'---');}finally{doc.free();}
}
