import {refinementStatus,handleRefinement,type RefinementEnv} from './cloud.js';
type Env=RefinementEnv&{ASSETS?:{fetch:(request:Request)=>Promise<Response>}};
// Shared Web Request handler used by the Vercel API entry points.
export default {async fetch(request:Request,env:Env){
 const url=new URL(request.url);
 if(url.pathname==='/api/refinement/status')return refinementStatus(env);
 if(url.pathname==='/api/refine')return handleRefinement(request,env);
 if(url.pathname==='/api/translate')return handleRefinement(request,env,undefined,'translate');
 if(url.pathname==='/api/health')return Response.json({ai:false,groq:!!env.GROQ_API_KEY,openai:!!env.OPENAI_API_KEY,gemini:!!env.GEMINI_API_KEY},{headers:{'cache-control':'no-store'}});
 if(url.pathname.startsWith('/api/'))return Response.json({error:'This tool is not configured on this deployment.'},{status:404});
 return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
}};
