import {keywordPadding} from './keywordPadding';

/** Separate wrapped lines so each background follows that line's actual glyphs. */
export function KeywordMark({text,color,ink,font,size,bold}:{text:string;color:string;ink?:string;font:string;size:number;bold:boolean}){
 return text.split(/(\n)/).map((part,index)=>{
  if(part==='\n'||!part.trim())return part;
  const bounds=keywordPadding(part,font,size,bold);
  return <mark key={index} style={{position:'relative',zIndex:0,background:'transparent',color:ink,padding:0}}>
   <span aria-hidden="true" style={{position:'absolute',zIndex:-1,pointerEvents:'none',left:-bounds.side,right:-bounds.side,bottom:bounds.bottom,height:bounds.height,background:color,borderRadius:2}}/>
   {part}
  </mark>;
 });
}
