import type {QuestionOrderStyle} from './questionOrder';
import type {QuestionColours} from './questionColours';
import type {LanguageFonts} from './languageFonts';
export type SlideTextBox=LanguageFonts&{id:string;text:string;x:number;y:number;w:number;h:number;font:string;size:number;bold:boolean;color:string;align:'left'|'center'|'right';lineHeight:number};
export type ImageCrop={x:number;y:number;w:number;h:number};
export type SlideImage={id:string;assetId:string;placement:ImagePlacement};
export type ImagePlacement={x:number;y:number;w:number;h:number;fit:'cover'|'contain';crop?:ImageCrop};
import type {SlideTimer} from './timers';
import type {TheoryLanguageCache} from './theoryLanguages';
import type {LocalizedMCQ,LanguageMode} from './languages';
﻿export type Variant = 'light'|'dark';
export type Layout = 'theory'|'title'|'section'|'mcq'|'two-mcq'|'answer'|'steps'|'table'|'image'|'blank';
export type Asset = {id:string; name:string; data:string; width:number; height:number};
export type SourceBlock = {id:string; kind:'text'|'question'|'table'; text:string; answer:string; rows?:string[][]; group:number};
export type TextStyle = LanguageFonts&QuestionColours&QuestionOrderStyle&{questionGap?:number;optionGap?:number;headingColor?:string;bulletColor?:string;translationGap?:number;labelColor?:string;size:number; titleSize:number; optionSize:number; font:string; bold:boolean; color:string; align:'left'|'center'|'right'; lineHeight:number; paragraphGap:number; highlight:string; highlightColor:string; bullets:boolean};
export type FontAsset={family:'Kokila';weight:700;name:string;data:string};
export type Theme = {headerText?:string;headerTextColor?:string;headerFontSize?:number;headerAlign?:'left'|'center'|'right';mode:'original'|'custom'; variant:Variant; templateIndex:number; background:string; headerColor:string; accent:string; textColor:string; headerHeight:number; logo?:string; logoLight?:string; logoDark?:string; logoWidth:number; logoX:number; logoY:number; logoPadding:number; watermark?:string; watermarkWidth:number; watermarkX:number; watermarkY:number; watermarkOpacity:number; backgroundImage?:string; backgroundFit:'cover'|'contain'; backgroundX:number; backgroundY:number; backgroundOpacity:number; headerImage?:string; headerFit:'cover'|'contain'; welcome?:string; closing?:string; footer:string; pageNumbers:boolean; course:string; subject:string; chapter:string; teacher:string};
export type Slide = {layerOrder?:string[];images?:SlideImage[];textBoxes?:SlideTextBox[];imagePlacement?:ImagePlacement;timer?:SlideTimer|null;theoryLanguages?:TheoryLanguageCache;theory?:{title:string};languages?:LocalizedMCQ;fixedSlot?:'welcome'|'thumbnail'|'closing';mcqOnly?:boolean;answerOrigin?:'source'|'manual';answerWarning?:string;correctOption?:number;answerReveal?:boolean;answerColor?:string;id:string; name:string; kind:'original'|'teaching'; templateIndex:number; layout:Layout; blocks:SourceBlock[]; text:string; notes:string; sourceIds:string[]; locked:boolean; manual:boolean; style:Partial<TextStyle>; theme?:Partial<Theme>; image?:string; optionsMode:'auto'|'adaptive'|'vertical'|'columns'; reserve:'none'|'left'|'right'; reserveWidth:number; workSpace:number; showAnswers:boolean; lockedElements:string[]; edits:Record<string,string>; continuation?:string};
export type StylePreset={timer?:SlideTimer|null;id:string;version:1;name:string;style:TextStyle;theme:Theme;assets:Record<string,Asset>;fonts:Record<string,FontAsset>;layout:Layout;optionsMode:Slide['optionsMode'];reserve:Slide['reserve'];reserveWidth:number;workSpace:number;answerColor:string;answerReveal:boolean};
export type Project = {timer?:SlideTimer|null;refinementMode?:'as-is'|'modify';refinedContentHash?:string;languageMode?:LanguageMode;contentMode?:'all'|'mcq-only'|'theory-bullets'|'theory-paragraphs';fonts?:Record<string,FontAsset>;schemaVersion:1; id:string; name:string; updatedAt:string; source:string; theme:Theme; style:TextStyle; slides:Slide[]; assets:Record<string,Asset>; includeWelcome:boolean; includeClosing:boolean; answerMode:'questions'|'separate'|'notes'; presets:{id:string;name:string;theme:Theme}[]};
export type TemplateItem = {kind:'image'|'text'; src?:string; text?:string;runs?:{text:string;bold?:boolean;color?:string}[]; x:number;y:number;w:number;h:number;size?:number;color?:string;font?:string;align?:'center'};
export type TemplateSet = Record<Variant,{slides:{index:number;name:string;items:TemplateItem[]}[];original:string}>;
export type Element = LanguageFonts&QuestionColours&{answerBox?:{x:number;y:number;w:number;h:number};imageFixed?:boolean;textBox?:SlideTextBox;imageCrop?:ImageCrop;imageSize?:[number,number];padding?:[number,number,number,number];valign?:'middle';timer?:SlideTimer;editId?:string;editText?:string;id:string;kind:'text'|'image'|'rect'|'table'|'equation'|'timer';x:number;y:number;w:number;h:number;text?:string;runs?:{text:string;bold?:boolean;color?:string}[];lines?:string[];src?:string;color?:string;fill?:string;size?:number;font?:string;bold?:boolean;align?:'left'|'center'|'right';lineHeight?:number;opacity?:number;fit?:'cover'|'contain'|'fill';rows?:string[][];rowHeights?:number[];sourceId?:string;editable?:boolean;highlight?:string;highlightColor?:string;objectPosition?:string};
export type ResolvedSlide={id:string;elements:Element[];warnings:string[];background:string;notes:string;name:string};
export const uid=()=>crypto.randomUUID();
export const templateNames=['Welcome','Thumbnail','Teaching · 01','Teaching · 02','Teaching · 03','Home Work','Thank you'];
export const defaultStyle:TextStyle={labelColor:'#ffff00',size:26,titleSize:34,optionSize:24,font:'Noto Sans Devanagari',bold:false,color:'',align:'left',lineHeight:1.35,paragraphGap:16,highlight:'',highlightColor:'#ffcc4d',bullets:false};
export const defaultTheme:Theme={headerText:'Type Your Text Here',mode:'original',variant:'dark',templateIndex:4,background:'#191b1c',headerColor:'#343434',accent:'#e21b2e',textColor:'#ffffff',headerHeight:115,logoWidth:235,logoX:1630,logoY:16,logoPadding:14,watermarkWidth:900,watermarkX:510,watermarkY:380,watermarkOpacity:.07,backgroundFit:'cover',backgroundX:50,backgroundY:50,backgroundOpacity:1,headerFit:'cover',footer:'',pageNumbers:false,course:'',subject:'',chapter:'',teacher:''};
export function blankSlide(index=4):Slide{return {id:uid(),name:'Blank teaching slide',kind:'teaching',templateIndex:index,layout:'blank',blocks:[],text:'',notes:'',sourceIds:[],locked:false,manual:false,style:{},optionsMode:'auto',reserve:'none',reserveWidth:440,workSpace:0,showAnswers:false,lockedElements:[],edits:{}}}
export function originalSlides():Slide[]{return templateNames.map((name,i)=>({...blankSlide(i),kind:'original',name}));}
export function newProject():Project{return {schemaVersion:1,id:uid(),name:'Untitled class',updatedAt:new Date().toISOString(),refinementMode:'as-is',source:'',theme:{...defaultTheme},style:{...defaultStyle},slides:originalSlides(),assets:{},includeWelcome:true,includeClosing:true,answerMode:'questions',presets:[]};}
export function setVariant(p:Project,v:Variant):Project{
 const palette={variant:v,background:v==='dark'?'#191b1c':'#ffffff',textColor:v==='dark'?'#ffffff':'#171925',headerColor:v==='dark'?'#343434':'#191b1c'};
 // Explicit body colours from a slide or saved style must not mask the new theme.
 // Each theme click restores its question/option label default, including slide overrides.
 const labelColor=v==='dark'?'#ffff00':'#e21b2e';
 return {...p,theme:{...p.theme,...palette,...(p.theme.mode==='original'?{headerTextColor:undefined}:{})},style:{...p.style,color:'',labelColor},slides:p.slides.map(s=>({...s,style:{...s.style,color:'',labelColor},...(s.textBoxes?{textBoxes:s.textBoxes.map(box=>({...box,color:''}))}:{}),theme:s.theme?{...s.theme,...palette,...((s.theme.mode||p.theme.mode)==='original'?{headerTextColor:undefined}:{})}:undefined}))};
}


