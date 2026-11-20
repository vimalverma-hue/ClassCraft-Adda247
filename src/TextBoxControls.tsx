import {FontSizeSlider} from './FontSizeSlider';
import {LanguageFontControls} from './LanguageFontControls';
import {hasLanguageFonts} from './languageFonts';
import {Type,Trash2} from 'lucide-react';
import type {SlideTextBox} from './model';
import {textBoxFonts} from './textBoxes';
export function TextBoxControls({box,disabled,addDisabled=false,autoColor,onAdd,onChange,onDelete}:{box?:SlideTextBox;disabled:boolean;addDisabled?:boolean;autoColor?:string;onAdd:()=>void;onChange:(patch:Partial<SlideTextBox>)=>void;onDelete:()=>void}){
 return <div className="text-tools">
  <button type="button" className="button add-text-button full" disabled={addDisabled} onClick={onAdd}><Type size={16}/>Add Text</button>
  {box&&<div className="text-box-controls">
   <label className="field"><span>Font</span><select aria-label="Added text font" value={box.font} disabled={disabled} onChange={e=>onChange({font:e.target.value,bold:['Kokila','Mangal','Aptos'].includes(e.target.value)?true:box.bold})}>{textBoxFonts.map(font=><option key={font} value={font}>{font==='Kokila'?'Kokila Bold':font==='Aptos'?'Aptos Bold':font}</option>)}</select></label>
   <LanguageFontControls value={box} onChange={onChange} disabled={disabled} prefix="Added text "/><div className="field-stack"><FontSizeSlider label="Size" ariaLabel="Added text size" value={box.size} min={8} max={120} step={.1} disabled={disabled} onChange={size=>onChange({size})}/><label className="field"><span>Alignment</span><select aria-label="Added text alignment" value={box.align} disabled={disabled} onChange={e=>onChange({align:e.target.value as SlideTextBox['align']})}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label></div>
   <div className="text-box-format"><button className={'button secondary'+(box.bold?' active':'')} aria-label="Added text bold" aria-pressed={box.bold} disabled={disabled||(!hasLanguageFonts(box)&&['Kokila','Mangal','Aptos'].includes(box.font))} onClick={()=>onChange({bold:!box.bold})}><b>B</b></button><input type="color" aria-label="Added text colour" value={box.color||autoColor||'#ffffff'} disabled={disabled} onChange={e=>onChange({color:e.target.value})}/><button className="text-button" disabled={disabled} onClick={()=>onChange({color:''})}>Auto</button><button className="icon-button" aria-label="Remove added text" disabled={disabled} onClick={onDelete}><Trash2 size={16}/></button></div>
  </div>}
 </div>;
}
