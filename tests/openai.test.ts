import {it,expect,vi} from 'vitest';
import {handleRefinement,refinementStatus} from '../src/server/cloud';
const env={OPENAI_API_KEY:'openai-test-secret',GROQ_API_KEY:'groq-test-secret'};
const request=()=>new Request('https://studio.test/api/refine',{method:'POST',headers:{origin:'https://studio.test','content-type':'application/json'},body:JSON.stringify({source:'Plants needs water.\n\nQ.1 Capital of India?\nA) Mumbai\nB) New Delhi\nAnswer: B'})});
it('prefers configured OpenAI and uses its request format without transmitting the Groq secret',async()=>{
 const fetcher=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{expect(url).toBe('https://api.openai.com/v1/chat/completions');expect((init!.headers as any).authorization).toBe('Bearer '+env.OPENAI_API_KEY);const body=JSON.parse(init!.body as string);expect(body.model).toBe('gpt-4.1-mini');expect(body.store).toBe(false);expect(body.reasoning_effort).toBeUndefined();expect(body.response_format.json_schema.strict).toBe(true);expect(init!.body).not.toContain('Capital');expect(JSON.stringify(init)).not.toContain(env.GROQ_API_KEY);const input=JSON.parse(body.messages[1].content);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({paragraphs:input.paragraphs.map((p:any)=>({...p,text:p.text.replace('needs','need')}))})}}]});});
 const response=await handleRefinement(request(),env,fetcher as typeof fetch),result=await response.json();expect(response.status).toBe(200);expect(result.text).toContain('Plants need water.');expect(result.text).toContain('Answer: B');expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.stringify(result)).not.toContain(env.OPENAI_API_KEY);
 const status=await refinementStatus(env).json();expect(status).toEqual({available:true,provider:'OpenAI',model:'gpt-4.1-mini'});
});
it('reports an expired OpenAI credential without exposing provider details or silently switching providers',async()=>{
 const fetcher=vi.fn(async()=>Response.json({error:{code:'expired_secret_key',message:env.OPENAI_API_KEY}},{status:401}));const response=await handleRefinement(request(),env,fetcher as typeof fetch);expect(response.status).toBe(503);const result=await response.json();expect(result.error).toContain('expired');expect(JSON.stringify(result)).not.toContain(env.OPENAI_API_KEY);expect(result.text).toBeUndefined();expect(fetcher).toHaveBeenCalledTimes(1);
});
it('retains Groq when OpenAI is not configured',async()=>{expect(await refinementStatus({GROQ_API_KEY:env.GROQ_API_KEY}).json()).toEqual({available:true,provider:'Groq',model:'openai/gpt-oss-120b'});});
