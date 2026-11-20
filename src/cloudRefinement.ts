import type {Refinement} from './refinement';
export async function cloudRefinement(source:string,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<Refinement>{
 const response=await fetcher('/api/refine',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source}),signal});
 let result:Refinement&{error?:string};try{result=await response.json();}catch{throw Error('AI service could not be reached. Reload the app and sign in if needed.');}
 if(!response.ok)throw Error(result.error||'AI refinement failed. Original content is unchanged.');
 if(typeof result.text!=='string'||!result.text.trim()||!Array.isArray(result.removed)||!Array.isArray(result.warnings)||[...result.removed,...result.warnings].some(v=>typeof v!=='string'))throw Error('AI returned an invalid proposal. Original content is unchanged.');
 return result;
}
