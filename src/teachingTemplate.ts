import type {Project} from './model';
import {fixedSlot} from './classSlides';
export function applyTeachingTemplate(p:Project,index:number):Project{
 if(![2,3,4].includes(index))return p;
 return{...p,theme:{...p.theme,mode:'original',templateIndex:index,headerTextColor:undefined},slides:p.slides.map(s=>fixedSlot(s)?s:{...s,templateIndex:index,theme:{...s.theme,mode:'original',variant:p.theme.variant,headerTextColor:undefined}})};
}
