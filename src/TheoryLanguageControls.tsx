import {useEffect,useRef,useState} from 'react';
import type {Project,TemplateSet} from './model';
import type {LanguageMode,LanguagePair} from './languages';
import {applyTheoryLanguageEntries,prepareTheoryLanguageProject,theoryLanguageEntries,theoryMissingDirections,theoryTranslationWarnings,translateTheoryEntries,type TheoryLanguageEntry} from './theoryLanguages';
import {translationSession} from './translation';
import {useTranslationEngine,TranslationChoice} from './TranslationChoice';
import type {TheoryMode} from './theory';
export function TheoryLanguageControls({project,templates,onApply}:{project:Project;templates:TemplateSet;onApply:(p:Project,count:number)=>Promise<void>}){
 const count=project.slides.filter(s=>s.kind==='teaching'&&s.layout==='theory').length;
 const[mode,setMode]=useState<LanguageMode>(project.languageMode||'both'),[input,setInput]=useState<'slides'|'source'>(count?'slides':'source');
 const[layout,setLayout]=useState<TheoryMode>(project.contentMode==='theory-paragraphs'?'theory-paragraphs':'theory-bullets');
 const translation=useTranslationEngine(),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const[proposal,setProposal]=useState<{project:Project;original:string;mode:LanguageMode;entries:TheoryLanguageEntry[]}|null>(null);
 const abort=useRef<AbortController|null>(null),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;abort.current?.abort();},[]);
 useEffect(()=>{generation.current++;abort.current?.abort();setBusy('');setProposal(null);setMode(project.languageMode||'both');setInput(count?'slides':'source');},[project.id]);
 async function convert(){
  const id=++generation.current,controller=new AbortController();abort.current=controller;let session:ReturnType<typeof translationSession>|undefined;setError('');setBusy('Preparing theory translation…');
  try{const next=prepareTheoryLanguageProject(project,templates,input,layout),entries=theoryLanguageEntries(next),original=JSON.stringify(project);
   session=translationSession(translation.engine,theoryMissingDirections(entries,mode),controller.signal,message=>{if(id===generation.current)setBusy(message);});
   const translated=await translateTheoryEntries(entries,mode,session.translate,controller.signal,(done,total)=>{if(id===generation.current)setBusy(total?`Translating headings and paragraphs · ${done} / ${total}`:'Using saved translations…');});
   controller.signal.throwIfAborted();if(id===generation.current)setProposal({project:next,original,mode,entries:translated});
  }catch(e){if(id===generation.current&&!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}finally{session?.close();if(id===generation.current){abort.current=null;setBusy('');}}
 }
 function editor(pair:LanguagePair,index:number,field:'title'|number,label:string){return <div className="language-pair-editor">{(['hi','en'] as const).filter(lang=>proposal!.mode==='both'||proposal!.mode===lang).map(lang=><label key={lang}><span>{label} · {lang==='hi'?'हिंदी':'English'}</span><textarea aria-label={`Theory ${index+1} ${label} ${lang}`} rows={3} value={pair[lang]||''} onChange={e=>{const text=e.target.value;setProposal(old=>{if(!old)return old;const next=structuredClone(old),value=field==='title'?next.entries[index].data.title!:next.entries[index].data.items[field];value[lang]=text;return next;});}}/></label>)}</div>;}
 async function apply(){if(!proposal)return;try{setError('');if(JSON.stringify(project)!==proposal.original)throw Error('The project changed during review. Close and convert the latest content again.');const next=applyTheoryLanguageEntries(proposal.project,proposal.entries,proposal.mode);setBusy('Saving translated theory…');await onApply(next,proposal.entries.length);setProposal(null);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy('');}}
 return <section className="language-controls"><h3>Theory language</h3>
 <label className="field"><span>Output language</span><select aria-label="Theory output language" value={mode} onChange={e=>setMode(e.target.value as LanguageMode)}><option value="both">हिंदी + English · दोनों</option><option value="hi">केवल हिंदी</option><option value="en">English only</option></select></label>
 <label className="field"><span>Theory to convert</span><select aria-label="Theory to convert" value={input} onChange={e=>setInput(e.target.value as typeof input)}><option value="slides">Current theory slides ({count})</option><option value="source">Extract from pasted / uploaded content</option></select></label>
 {input==='source'&&<label className="field"><span>Theory layout</span><select aria-label="Translated theory layout" value={layout} onChange={e=>setLayout(e.target.value as TheoryMode)}><option value="theory-bullets">Headings + bullet points</option><option value="theory-paragraphs">Paragraph notes</option></select></label>}
 <TranslationChoice {...translation}/><button className="button secondary full" disabled={!!busy||(input==='slides'?!count:!project.source.trim())} onClick={convert}>Convert & review all theory slides</button>
 {error&&<p className="language-error" role="alert">{error}</p>}
 {proposal&&<div className="modal-backdrop"><section className="modal wide language-modal" role="dialog" aria-modal="true" aria-label="Review theory translations"><div className="modal-heading"><h2>Review {proposal.entries.length} theory sections · {proposal.mode==='both'?'हिंदी + English':proposal.mode==='hi'?'हिंदी':'English'}</h2><button className="icon-button" aria-label="Close translation preview" onClick={()=>setProposal(null)}>×</button></div><div className="language-review-list">{proposal.entries.map((entry,i)=><article key={entry.slideId}><h3>Theory section {i+1}</h3><details><summary>Original theory content</summary><pre>{entry.before}</pre></details>{theoryTranslationWarnings(entry.data).map(w=><p className="language-error" key={w}>{w}</p>)}{entry.data.title&&editor(entry.data.title,i,'title','Heading')}{entry.data.items.map((item,j)=><div key={j}>{editor(item,i,j,'Paragraph '+(j+1))}</div>)}</article>)}</div>{error&&<p className="language-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" onClick={()=>setProposal(null)}>Cancel</button><button className="button primary" disabled={!!busy} onClick={apply}>Apply to all {proposal.entries.length} theory sections</button></div></section></div>}
 {busy&&<div className="busy-overlay"><div className="busy-card"><div className="spinner"/><strong role="status">{busy}</strong>{abort.current&&<button className="button secondary" onClick={()=>abort.current?.abort()}>Cancel conversion</button>}</div></div>}
 </section>;
}
