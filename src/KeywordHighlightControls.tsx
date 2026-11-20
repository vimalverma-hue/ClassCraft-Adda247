import {Highlighter} from 'lucide-react';
import {SettingsSection} from './SettingsSection';
import type {TextStyle} from './model';

export function KeywordHighlightControls({style,selectedText,onStyle}:{style:TextStyle;selectedText:string;onStyle:(style:Partial<TextStyle>)=>void}){
 return <SettingsSection title="Keyword highlight">
  <button className="button primary full" disabled={!selectedText.trim()} onMouseDown={event=>event.preventDefault()} onClick={()=>{
   if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
   onStyle({highlight:selectedText.trim().replace(/\s+/gu,' ')});
  }}><Highlighter size={16}/>Highlight</button>
  <label className="field"><span>Highlight keyword (exact match)</span><input value={style.highlight} onChange={event=>onStyle({highlight:event.target.value})} placeholder="Enter a word or phrase"/></label>
  <div className="colour-row"><label>Highlight colour<input type="color" value={style.highlightColor} onChange={event=>onStyle({highlightColor:event.target.value})}/></label></div>
 </SettingsSection>;
}
