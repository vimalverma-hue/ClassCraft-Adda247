import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import health from '../api/health';
import status from '../api/refinement/status';
import refine from '../api/refine';
import translate from '../api/translate';

const origin='https://classcraft-example.vercel.app';
function post(path:string,body:unknown,requestOrigin=origin){
  return new Request(origin+path,{method:'POST',headers:{origin:requestOrigin,'content-type':'application/json'},body:JSON.stringify(body)});
}
beforeEach(()=>{
  for(const name of ['GEMINI_API_KEY','GEMINI_MODEL','OPENAI_API_KEY','OPENAI_MODEL','GROQ_API_KEY','GROQ_MODEL'])vi.stubEnv(name,'');
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

it('serves health and no-key status through the Vercel entry points',async()=>{
  const response=await health.fetch(new Request(origin+'/api/health'));
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ai:false,groq:false,openai:false,gemini:false});
  expect((await (await status.fetch(new Request(origin+'/api/refinement/status'))).json()).available).toBe(false);
  const result=await refine.fetch(post('/api/refine',{source:'Plants needs water.'}));
  expect(result.status).toBe(503);
});

it('reads server environment settings without exposing a credential',async()=>{
  vi.stubEnv('GEMINI_API_KEY','test-only-provider-credential');
  vi.stubEnv('GEMINI_MODEL','test-model');
  const response=await status.fetch(new Request(origin+'/api/refinement/status'));
  expect(await response.json()).toEqual({available:true,provider:'Gemini',model:'test-model'});
});

it('retains origin, method and input validation on Vercel',async()=>{
  expect((await refine.fetch(post('/api/refine',{source:'Example.'},'https://other.example'))).status).toBe(403);
  expect((await refine.fetch(new Request(origin+'/api/refine'))).status).toBe(405);
  expect((await refine.fetch(post('/api/refine',{unexpected:true}))).status).toBe(400);
});

it('refines through the server adapter using the selected provider',async()=>{
  vi.stubEnv('GEMINI_API_KEY','test-only-provider-credential');
  const mock=vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
    expect(String(_url)).toContain('generativelanguage.googleapis.com');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-only-provider-credential');
    const body=JSON.parse(String(init?.body));
    const input=JSON.parse(body.messages[1].content);
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({paragraphs:input.paragraphs.map((p:{id:number;text:string})=>({...p,text:p.text.replace('needs','need')}))})}}]});
  });
  vi.stubGlobal('fetch',mock);
  const response=await refine.fetch(post('/api/refine',{source:'Plants needs water.'}));
  expect(response.status).toBe(200);
  expect((await response.json()).text).toBe('Plants need water.');
  expect(mock).toHaveBeenCalledTimes(1);
});

it('translates Hindi theory through the Vercel translation route',async()=>{
  vi.stubEnv('GEMINI_API_KEY','test-only-provider-credential');
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({paragraphs:[{id:0,text:'It came into effect in 1950.'}]})}}]})));
  const response=await translate.fetch(post('/api/translate',{source:'यह 1950 में लागू हुआ।',from:'hi',to:'en'}));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({text:'It came into effect in 1950.'});
});
