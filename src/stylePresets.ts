import {validateQuestionOrder} from './questionOrder';
import {validateQuestionColours} from './questionColours';
import {validateLanguageFonts} from './languageFonts';
import {answerColour} from './answers';
import type {Project,Slide,StylePreset} from './model';
import {uid} from './model';
import {slideTimer,supportsTimer} from './timers';
import {validateFontAsset} from './fonts';
export function makeStylePreset(p:Project,s:Slide,name:string):StylePreset{return {id:uid(),name:name.trim(),version:1,timer:slideTimer(p,s),style:{...p.style,...s.style},theme:{...p.theme,...s.theme},assets:structuredClone(p.assets),fonts:structuredClone(p.fonts||{}),layout:s.layout,optionsMode:s.optionsMode,reserve:s.reserve,reserveWidth:s.reserveWidth,workSpace:s.workSpace,answerColor:answerColour(s.answerColor),answerReveal:s.answerReveal??true};}
export function applyStylePreset(p:Project,preset:StylePreset,index?:number):Project{
 const apply=(s:Slide):Slide=>({...s,timer:supportsTimer(s)?preset.timer:null,style:{...preset.style},theme:{...preset.theme},templateIndex:s.kind==='original'?s.templateIndex:preset.theme.templateIndex,optionsMode:preset.optionsMode,reserve:preset.reserve,reserveWidth:preset.reserveWidth,workSpace:preset.workSpace,answerColor:preset.answerColor,answerReveal:preset.answerReveal,manual:true});
 return {...p,...(index===undefined?{timer:preset.timer}:{}),theme:index===undefined?{...preset.theme}:p.theme,style:index===undefined?{...preset.style}:p.style,assets:{...p.assets,...preset.assets},fonts:{...p.fonts,...preset.fonts},slides:p.slides.map((s,i)=>index===undefined||i===index?apply(s):s)};
}
export function validateStylePreset(value:unknown):asserts value is StylePreset{const x=value as StylePreset;if(!x||x.version!==1||typeof x.name!=='string'||!x.name.trim()||!x.style||!x.theme||!['dark','light'].includes(x.theme.variant)||!Number.isFinite(x.style.size)||x.style.size<20||!x.assets)throw Error('Invalid style preset.');validateLanguageFonts(x.style);validateQuestionColours(x.style);validateQuestionOrder(x.style);for(const a of Object.values(x.assets))if(!/^data:image\/(png|jpeg|webp);base64,/.test(a.data))throw Error('Invalid preset image.');for(const f of Object.values(x.fonts||{}))validateFontAsset(f);}
