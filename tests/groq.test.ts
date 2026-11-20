import {it,expect,vi} from 'vitest';
import {handleRefinement,refinementStatus,refineCloud} from '../src/server/cloud';
import worker from '../src/server';
import {cloudRefinement} from '../src/cloudRefinement';
const env={GROQ_API_KEY:'test-server-secret',GROQ_MODEL:'openai/gpt-oss-120b'};
const request=(source:string,overrides:RequestInit={})=>new Request('https://studio.test/api/refine',{method:'POST',headers:{origin:'https://studio.test','content-type':'application/json'},body:JSON.stringify({source}),...overrides});
function provider(change:(text:string)=>string=(t=>t.replace('It define','It defines'))){return vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{const payload=JSON.parse(init?.body as string),input=JSON.parse(payload.messages[1].content);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({paragraphs:input.paragraphs.map((p:any)=>({id:p.id,text:change(p.text)}))})}}]});});}
it('uses the server secret only at Groq and preserves question/options/answer in the proposal',async()=>{
 const fetcher=provider(),mcq='Q.1 Capital of India?\nA) Mumbai\nB) New Delhi\nAnswer: B';const response=await handleRefinement(request('Advertisement\n\nIt define the structure of government.\n\n'+mcq),env,fetcher as typeof fetch);const result=await response.json();expect(response.status).toBe(200);expect(result.text).toContain('It defines');expect(result.text).toContain(mcq);expect(result.removed).toEqual(['Advertisement']);const[url,init]=fetcher.mock.calls[0];expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');expect((init!.headers as any).authorization).toBe('Bearer test-server-secret');expect(init!.body).not.toContain(mcq);expect(JSON.stringify(result)).not.toContain(env.GROQ_API_KEY);expect(response.headers.get('cache-control')).toBe('no-store');
});
it('rejects cross-origin, wrong-method, malformed, oversized and unconfigured requests before provider calls',async()=>{
 const fetcher=provider();expect((await handleRefinement(request('Notes',{headers:{origin:'https://elsewhere.test','content-type':'application/json'}}),env,fetcher as typeof fetch)).status).toBe(403);expect((await handleRefinement(new Request('https://studio.test/api/refine'),env,fetcher as typeof fetch)).status).toBe(405);expect((await handleRefinement(request('x',{body:'{'}),env,fetcher as typeof fetch)).status).toBe(400);expect((await handleRefinement(request('x'.repeat(24001)),env,fetcher as typeof fetch)).status).toBe(400);expect((await handleRefinement(request('Valid prose for editing.'),{},fetcher as typeof fetch)).status).toBe(503);expect(fetcher).not.toHaveBeenCalled();
});
it('returns useful errors without exposing raw provider errors or the key and rejects partial output',async()=>{
 const quota=await handleRefinement(request('A sentence to refine for teaching.'),env,async()=>Response.json({error:{message:'private '+env.GROQ_API_KEY}},{status:429}));expect(quota.status).toBe(429);expect(await quota.text()).not.toContain(env.GROQ_API_KEY);
 for(const choice of [{finish_reason:'length',message:{content:'partial'}},{finish_reason:'stop',message:{content:'{"paragraphs":[]}'}}]){const r=await handleRefinement(request('A sentence to refine for teaching.'),env,async()=>Response.json({choices:[choice]}));expect(r.status).toBe(502);expect((await r.json()).text).toBeUndefined();}
});
it('validates numeric preservation and batches paragraphs without silently applying partial batches',async()=>{
 const changed=await refineCloud('The Constitution took effect in 1950.',env,new AbortController().signal,provider(t=>t.replace('1950','1951')) as typeof fetch);expect(changed.text).toContain('1950');expect(changed.warnings.join(' ')).toContain('numeric');
 const source=Array.from({length:12},(_,i)=>`Paragraph ${i}: It define a separate teaching concept.`).join('\n\n'),fetcher=provider();const result=await refineCloud(source,env,new AbortController().signal,fetcher as typeof fetch);expect(fetcher).toHaveBeenCalledTimes(2);expect(result.text.match(/It defines/g)).toHaveLength(12);
 let call=0;const r=await handleRefinement(request(source),env,async(u,o)=>++call===1?fetcher(u,o):new Response('',{status:500}));expect(r.status).toBe(502);expect((await r.json()).text).toBeUndefined();
});
it('cancels provider requests and exposes only availability in status responses',async()=>{
 const controller=new AbortController();const fetcher=vi.fn(async(_u:any,init:any)=>{controller.abort();init.signal.throwIfAborted();return Response.json({});});const response=await handleRefinement(request('A sentence to refine for teaching.',{signal:controller.signal}),env,fetcher as typeof fetch);expect(response.status).toBe(499);const status=await refinementStatus(env).json();expect(status.available).toBe(true);expect(JSON.stringify(status)).not.toContain(env.GROQ_API_KEY);
 const assets={fetch:vi.fn(async()=>new Response('app asset'))};expect(await(await worker.fetch(new Request('https://studio.test/'),{ASSETS:assets})).text()).toBe('app asset');expect(assets.fetch).toHaveBeenCalledTimes(1);
});
it('validates client proposals and handles sign-in HTML without replacing source',async()=>{
 const result={text:'Refined prose.',removed:[],warnings:[]};expect(await cloudRefinement('Raw prose.',new AbortController().signal,async()=>Response.json(result))).toEqual(result);
 await expect(cloudRefinement('Raw prose.',new AbortController().signal,async()=>new Response('<html>Sign in</html>'))).rejects.toThrow('sign in');await expect(cloudRefinement('Raw prose.',new AbortController().signal,async()=>Response.json({text:1}))).rejects.toThrow('invalid');
});
