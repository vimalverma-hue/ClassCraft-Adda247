import type {Project,Slide} from './model';
export const timerDurations=[10,20,30,60,120,180] as const;
export const timerMinSize=120,timerMaxSize=500;
export type SlideTimer={seconds:typeof timerDurations[number];x:number;y:number;size:number;textColor?:string;faceColor?:string};
export function timerConfig(value?:SlideTimer|null):SlideTimer|undefined{if(!value)return;const size=Math.max(timerMinSize,Math.min(timerMaxSize,Number(value.size)||200));return{seconds:timerDurations.includes(value.seconds)?value.seconds:30,size,x:Math.max(0,Math.min(1920-size,Number(value.x)||0)),y:Math.max(0,Math.min(1080-size,Number(value.y)||0)),...(value.textColor?{textColor:timerTextColor(value)}:{}),...(value.faceColor?{faceColor:timerFaceColor(value)}:{})};}
/** Original Teaching 01/02/03 are eligible too; covers and other originals never are. */
export const supportsTimer=(s:Slide)=>!s.fixedSlot&&[2,3,4].includes(s.templateIndex);
export const slideTimer=(p:Project,s:Slide)=>supportsTimer(s)?timerConfig(s.timer===undefined?p.timer:s.timer):undefined;
export function timerPosition(timer:SlideTimer,place:string){return timerConfig({...timer,x:place.endsWith('left')?80:1840-timer.size,y:place.startsWith('top')?160:990-timer.size})!;}
export function applyTimer(p:Project,timer:SlideTimer|null,index?:number):Project{return{...p,...(index===undefined?{timer}:{}),slides:p.slides.map((s,i)=>!supportsTimer(s)?{...s,timer:null}:index===undefined||i===index?{...s,timer:timer?{...timer}:null}:s)};}
function updateExistingTimers(p:Project,change:(timer:SlideTimer)=>SlideTimer,index?:number):Project{
 return {...p,...(index===undefined&&p.timer?{timer:change(p.timer)}:{}),slides:p.slides.map((s,i)=>{const timer=slideTimer(p,s);return timer&&(index===undefined||i===index)?{...s,timer:change(timer)}:s;})};
}
export const applyTimerTextColor=(p:Project,textColor:string|undefined,index?:number)=>updateExistingTimers(p,timer=>timerConfig({...timer,textColor})!,index);
export const applyTimerFaceColor=(p:Project,faceColor:string|undefined,index?:number)=>updateExistingTimers(p,timer=>timerConfig({...timer,faceColor})!,index);
/** Keep the centre fixed, moving only enough to stay inside the slide at an edge. */
export function resizeTimer(timer:SlideTimer,size:number):SlideTimer{
 const before=timerConfig(timer)!,after=timerConfig({...before,size})!;
 return timerConfig({...after,x:before.x+(before.size-after.size)/2,y:before.y+(before.size-after.size)/2})!;
}
export const applyTimerSize=(p:Project,size:number,index?:number)=>updateExistingTimers(p,timer=>resizeTimer(timer,size),index);
export const timerLabel=(seconds:number)=>seconds<=60?seconds+' SEC':(seconds/60)+' MIN';
/** Up to 60 seconds uses plain digits; longer timers retain mm:ss below a minute. */
export const timerDigits=(remaining:number,total:number)=>total<=60?String(Math.max(0,Math.ceil(remaining))):String(Math.floor(Math.max(0,remaining)/60)).padStart(2,'0')+':'+String(Math.max(0,Math.ceil(remaining))%60).padStart(2,'0');
export const timerProgress=(elapsed:number,total:number)=>Math.max(0,Math.min(1,elapsed/total));
export const timerNumberSize=(total:number)=>total<=60?84:52;
export const timerFace='#201114',timerRed='#ff0026',timerText='#ffff00';
export const timerTextColor=(timer:SlideTimer)=>/^#[0-9a-f]{6}$/i.test(timer.textColor||'')?timer.textColor!.toLowerCase():timerText;
export const timerFaceColor=(timer:SlideTimer)=>/^#[0-9a-f]{6}$/i.test(timer.faceColor||'')?timer.faceColor!.toLowerCase():timerFace;
