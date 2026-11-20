import {useEffect,useRef,useState} from 'react';
import type {Project,TemplateSet} from './model';
import {applyLanguageEntries,languageEntries,missingDirections,prepareLanguageProject,translateEntries,translationWarnings,type LanguageEntry,type LanguageMode,type LanguagePair} from './languages';
import {translationSession} from './translation';
import {TheoryLanguageControls} from './TheoryLanguageControls';
import {useTranslationEngine,TranslationChoice} from './TranslationChoice';

function MCQLanguageControls({project,templates,onApply}:{project:Project;templates:TemplateSet;onApply:(p:Project,count:number)=>Promise<void>}){
 const count=project.slides.filter(s=>['mcq','two-mcq'].includes(s.layout)).length;
 const input=count?'slides':'source';
 const[mode,setMode]=useState<LanguageMode>(project.languageMode||'both');
 const translation=useTranslationEngine(),engine=translation.engine;
 const[busy,setBusy]=useState(''),[error,setError]=useState('');
 const[proposal,setProposal]=useState<{project:Project;entries:LanguageEntry[];mode:LanguageMode}|null>(null);
 const abort=useRef<AbortController|null>(null);
 useEffect(()=>()=>abort.current?.abort(),[]);
 useEffect(()=>{setMode(project.languageMode||'both');setProposal(null);setError('');},[project.id]);
 async function convert(){
  setError('');const controller=new AbortController();abort.current=controller;let session:ReturnType<typeof translationSession>|undefined;
  try{
   const next=prepareLanguageProject(project,templates,input),entries=languageEntries(next);
   setBusy('Preparing question translation…');
   session=translationSession(engine,missingDirections(entries,mode),controller.signal,setBusy);
   const translated=await translateEntries(entries,mode,session.translate,controller.signal,(done,total)=>setBusy(total?`Translating questions and options · ${done} / ${total}`:'Using the languages already in your content…'));
   controller.signal.throwIfAborted();setProposal({project:next,entries:translated,mode});
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}
  finally{session?.close();abort.current=null;setBusy('');}
 }
 function edit(index:number,field:'question'|number,lang:'hi'|'en',text:string){setProposal(old=>{if(!old)return old;const entries=structuredClone(old.entries);const pair=field==='question'?entries[index].data.question:entries[index].data.options[field];pair[lang]=text;return{...old,entries};});}
 function editor(pair:LanguagePair,index:number,field:'question'|number,label:string){return<div className="language-pair-editor">{(['hi','en'] as const).filter(lang=>proposal!.mode==='both'||proposal!.mode===lang).map(lang=><label key={lang}><span>{label} · {lang==='hi'?'हिंदी':'English'}</span><textarea aria-label={`Question ${index+1} ${label} ${lang}`} rows={field==='question'?3:2} value={pair[lang]||''} onChange={e=>edit(index,field,lang,e.target.value)}/></label>)}</div>;}
 return <section className="language-controls question-language-controls">
  <h3>Question language</h3>

  <label className="field"><span>Output language</span><select aria-label="Question output language" value={mode} onChange={e=>setMode(e.target.value as LanguageMode)}><option value="both">हिंदी + English · दोनों</option><option value="hi">केवल हिंदी</option><option value="en">English only</option></select></label>
  <TranslationChoice {...translation}/>
  <button className="button full mcq-convert-button" disabled={!!busy||(!count&&!project.source.trim())} onClick={convert}>Convert & review all MCQs</button>

  {error&&<p className="language-error" role="alert">{error}</p>}
  {proposal&&<div className="modal-backdrop"><section className="modal wide language-modal" role="dialog" aria-modal="true" aria-label="Review question translations"><div className="modal-heading"><h2>Review {proposal.entries.length} MCQs · {proposal.mode==='both'?'हिंदी + English':proposal.mode==='hi'?'हिंदी':'English'}</h2><button className="icon-button" aria-label="Close translation preview" onClick={()=>setProposal(null)}>×</button></div><div className="language-review-list">{proposal.entries.map((entry,i)=><article key={entry.slideId}><h3>{entry.data.prefix||`Question ${i+1}`}</h3><details><summary>Original question and options</summary><pre>{entry.before}</pre></details>{translationWarnings(entry.data).map(w=><p className="language-error" key={w}>{w}</p>)}{editor(entry.data.question,i,'question','Question')}{entry.data.options.map((o,j)=><div key={j}>{editor(o,i,j,o.label)}</div>)}</article>)}</div>{error&&<p className="language-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" onClick={()=>setProposal(null)}>Cancel</button><button className="button primary" onClick={async()=>{try{setError('');const next=applyLanguageEntries(proposal.project,proposal.entries,proposal.mode,templates);setBusy('Saving translated MCQs…');await onApply(next,proposal.entries.length);setProposal(null);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy('');}}}>Apply to all {proposal.entries.length} MCQs</button></div></section></div>}
  {busy&&<div className="busy-overlay"><div className="busy-card"><div className="spinner"/><strong role="status">{busy}</strong>{abort.current&&<button className="button secondary" onClick={()=>abort.current?.abort()}>Cancel conversion</button>}</div></div>}
 </section>;
}

export function LanguageControls({project,templates,onApply,kind}:{project:Project;templates:TemplateSet;kind?:'mcq'|'theory';onApply:(p:Project,count:number,kind:'mcq'|'theory')=>Promise<void>}){
 const contentKind=kind??(project.contentMode?.startsWith('theory-')||project.slides.some(s=>s.layout==='theory')&&!project.slides.some(s=>['mcq','two-mcq'].includes(s.layout))?'theory':'mcq');
 return contentKind==='theory'?<TheoryLanguageControls key={project.id} project={project} templates={templates} onApply={(next,count)=>onApply(next,count,'theory')}/>:<MCQLanguageControls key={project.id} project={project} templates={templates} onApply={(next,count)=>onApply(next,count,'mcq')}/>;
}
