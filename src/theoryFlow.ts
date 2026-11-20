import type {Project} from './model';
import {paginateTheory,theoryLayout,theoryContent,pairedTheoryText} from './theory';
import {theoryLanguageEntries,applyTheoryLanguageEntries} from './theoryLanguages';
/** Reflow only overflowing unlocked theory, keeping valid translation groups together. */
export function autoFlowTheory(p:Project):Project{
 const overflow=new Set(p.slides.filter(s=>s.kind==='teaching'&&s.layout==='theory'&&s.theory&&!s.locked&&!s.lockedElements.length&&theoryLayout(p,s).warnings.length).map(s=>s.id));
 if(!overflow.size)return p;let next=p;
 for(const entry of theoryLanguageEntries(p)){
  if(!entry.slideIds.some(id=>overflow.has(id)))continue;
  const slides=next.slides.filter(s=>entry.slideIds.includes(s.id));if(slides.some(s=>s.locked||s.lockedElements.length))continue;
  const visible=slides.flatMap(s=>[s.edits['theory-title']??s.theory?.title??'',...theoryContent(s)]).filter(Boolean);
  const mode=visible.some(v=>pairedTheoryText(v).secondary)?'both':visible.some(v=>/[\u0900-\u097f]/.test(v))?'hi':'en';
  const pairs=[...(entry.data.title?[entry.data.title]:[]),...entry.data.items],complete=pairs.every(v=>mode==='both'?v.hi&&v.en:v[mode]);
  if(complete)next={...applyTheoryLanguageEntries(next,[entry],mode),languageMode:p.languageMode};
  else next={...next,slides:next.slides.flatMap(s=>overflow.has(s.id)?paginateTheory(next,s):[s])};
 }
 return next;
}
