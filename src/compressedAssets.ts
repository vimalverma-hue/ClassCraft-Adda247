/** Decode the build's oversized fallback WASM assets before the runtime sees them. */
export function installCompressedAssetFetch(){
 const original=globalThis.fetch.bind(globalThis);
 globalThis.fetch=async(input,init)=>{
  const response=await original(input,init);
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,globalThis.location.href);
  if(url.origin!==globalThis.location.origin||url.searchParams.get('classslide-compressed-wasm')!=='1'||!response.ok||!response.body)return response;
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');headers.set('content-type','application/wasm');
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip')),{status:response.status,statusText:response.statusText,headers});
 };
 return()=>{globalThis.fetch=original;};
}
