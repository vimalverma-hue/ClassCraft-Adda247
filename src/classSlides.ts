import {blankSlide,type Project,type Slide} from './model';
export type FixedSlot='welcome'|'thumbnail'|'closing';
const slots:{role:FixedSlot;index:number;name:string}[]=[{role:'welcome',index:0,name:'Welcome'},{role:'thumbnail',index:1,name:'Thumbnail'},{role:'closing',index:6,name:'Thank you'}];
export function fixedSlot(s:Slide):FixedSlot|undefined{return s.fixedSlot||slots.find(slot=>s.kind==='original'&&s.templateIndex===slot.index)?.role;}

/** Every class has the original opening, thumbnail and closing in fixed positions. */
export function ensureClassSlides(p:Project,previous?:Project):Project{
 const prior=previous?.id===p.id?previous.slides:[];
 const frames=slots.map(slot=>{
  const old=p.slides.find(s=>fixedSlot(s)===slot.role)||prior.find(s=>fixedSlot(s)===slot.role);
  const s=old||{...blankSlide(slot.index),name:slot.name};
  return{...s,fixedSlot:slot.role,kind:'original' as const,templateIndex:slot.index,layout:'blank' as const,theme:{mode:'original' as const,...s.theme,variant:p.theme.variant}};
 });
 return{...p,includeWelcome:true,includeClosing:true,slides:[frames[0],frames[1],...p.slides.filter(s=>!fixedSlot(s)),frames[2]]};
}
export function insertionPosition(p:Project,selected:number){return Math.max(2,Math.min(selected+1,p.slides.length-1));}
export function moveContentSlide(p:Project,from:number,to:number):{project:Project;active:number}{
 if(!Number.isInteger(from)||!Number.isInteger(to)||!p.slides[from]||fixedSlot(p.slides[from]))return{project:p,active:from};
 const target=Math.max(2,Math.min(to,p.slides.length-2));if(target===from)return{project:p,active:from};
 const slides=[...p.slides],slide=slides.splice(from,1)[0];slides.splice(target,0,slide);return{project:ensureClassSlides({...p,slides}),active:target};
}
