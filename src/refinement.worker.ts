import {pipeline,env,type TextGenerationPipeline} from '@huggingface/transformers';
import {refinementModel,refinementMessages,refineWithModel} from './refinement';
import {installCompressedAssetFetch} from './compressedAssets';
installCompressedAssetFetch();
let generator:Promise<TextGenerationPipeline>|undefined;
const progress=(message:string)=>self.postMessage({type:'progress',message});
async function model(){
 if(!generator)generator=(async()=>{
  env.allowLocalModels=false;env.useWasmCache=false;
  const gpu=(navigator as unknown as {gpu?:{requestAdapter:()=>Promise<unknown>}}).gpu;const device=gpu&&await gpu.requestAdapter()?'webgpu':'wasm';
  progress(`Loading on-device AI (${device==='webgpu'?'GPU':'CPU — may be slow'})…`);
  const runtime=device==='webgpu'?'ort-wasm-simd-threaded.jsep':'ort-wasm-simd-threaded';const response=await fetch('/readers/ai/'+runtime+'.wasm.gz');if(!response.ok||!response.body)throw Error('AI runtime could not be loaded. Reload the app.');
  const wasm=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  Object.assign(env.backends.onnx.wasm!,{numThreads:1,proxy:false,wasmBinary:wasm,wasmPaths:{mjs:new URL('/readers/ai/'+runtime+'.mjs',self.location.origin).href}});
  return pipeline('text-generation',refinementModel.id,{device,dtype:'q4',revision:refinementModel.revision,progress_callback:event=>{if('progress'in event)progress(`Downloading AI model · ${Math.round(event.progress)}%${'file'in event?' ('+event.file+')':''}`);}}) as Promise<TextGenerationPipeline>;
 })().catch(e=>{generator=undefined;throw e;});return generator;
}
self.onmessage=async(event:MessageEvent<{source:string}>)=>{try{if(event.data.source.length>24000)throw Error('On-device AI supports up to 24,000 characters per review. Refine a smaller section, or use Basic cleanup.');const pipe=await model();const result=await refineWithModel(event.data.source,async text=>{const output=await pipe(refinementMessages(text),{max_new_tokens:640,do_sample:false,tokenizer_kwargs:{enable_thinking:false},repetition_penalty:1.08});const generated=(output[0] as {generated_text:string|{role:string;content:string}[]}).generated_text;return typeof generated==='string'?generated:generated.at(-1)?.content||'';},progress);self.postMessage({type:'result',result});}catch(e){self.postMessage({type:'error',message:e instanceof Error?e.message:String(e)});}};
