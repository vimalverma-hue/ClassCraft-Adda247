export type LanguageFonts={hindiFont?:string;englishFont?:string};
export const fontFamilies=['Noto Sans Devanagari','Noto Sans','Kokila','Mangal','Aptos','Rajdhani'];
export const fontLabel=(font:string)=>font==='Kokila'?'Kokila Bold':font==='Aptos'?'Aptos Bold':font;
export const boldFont=(font:string)=>['Kokila','Mangal','Aptos'].includes(font);
export const hasLanguageFonts=(value:LanguageFonts)=>!!(value.hindiFont||value.englishFont);
export const languageFontFields=(value:LanguageFonts):LanguageFonts=>hasLanguageFonts(value)?{hindiFont:value.hindiFont,englishFont:value.englishFont}:{};
export function validateLanguageFonts(value:LanguageFonts){for(const font of [value.hindiFont,value.englishFont])if(font!==undefined&&font!==''&&!fontFamilies.includes(font))throw Error('Invalid language font.');}
const hindi=/[\u0900-\u097f\u1cd0-\u1cff\ua8e0-\ua8ff]/u;
const letterOrNumber=/[\p{L}\p{N}]/u;
export type FontRun={text:string;font:string;bold:boolean};
/** Keep combining marks/joiners with their script; Latin labels and numbers use English. */
export function languageTextRuns(text:string):{text:string;language:'hi'|'en'}[]{
 const chars=[...text],scripts=chars.map(c=>hindi.test(c)?'hi':letterOrNumber.test(c)?'en':null);
 let previous:'hi'|'en'|null=null;
 const result:{text:string;language:'hi'|'en'}[]=[];
 for(let i=0;i<chars.length;i++){
  const script=scripts[i]||previous||scripts.slice(i+1).find(Boolean)||'en';
  if(scripts[i])previous=scripts[i];
  if(chars[i]==='\n')previous=null;
  const last=result.at(-1);
  if(last?.language===script)last.text+=chars[i];else result.push({text:chars[i],language:script});
 }
 return result;
}
export function languageFontRuns(text:string,font:string,bold:boolean,value:LanguageFonts):FontRun[]{
 if(!hasLanguageFonts(value))return[{text,font,bold}];
 const result:FontRun[]=[];
 for(const run of languageTextRuns(text)){
  const selected=(run.language==='hi'?value.hindiFont:value.englishFont)||font;
  // The bundled Devanagari face uses Noto Sans for Latin, as in the legacy renderer.
  const face=run.language==='en'&&selected==='Noto Sans Devanagari'?'Noto Sans':selected;
  const weight=bold||boldFont(face),last=result.at(-1);
  if(last?.font===face&&last.bold===weight)last.text+=run.text;else result.push({text:run.text,font:face,bold:weight});
 }
 return result;
}
export function editingFontStack(font:string,value:LanguageFonts){return hasLanguageFonts(value)?`"${value.englishFont||font}","${value.hindiFont||font}","Noto Sans Devanagari","Noto Sans",sans-serif`:`"${font}","Noto Sans",sans-serif`;}
