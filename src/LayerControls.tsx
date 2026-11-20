import type {Element} from './model';
import {isSlideLayer,layerId,type LayerDirection} from './layerOrder';
export function LayerControls({elements,selected,disabled,onSelect,onMove}:{elements:Element[];selected:string;disabled:boolean;onSelect:(id:string)=>void;onMove:(direction:LayerDirection)=>void}){
 const layers=elements.filter((e,i,all)=>isSlideLayer(e)&&all.findIndex(other=>isSlideLayer(other)&&layerId(other)===layerId(e))===i);
 if(!layers.length)return null;
 const active=layers.some(e=>layerId(e)===selected);
 return <div className="layer-tools">
  <select aria-label="Select image or text" value={active?selected:''} onChange={e=>onSelect(e.target.value)}>
   <option value="" disabled>Select image or text</option>
   {layers.map((e,i)=><option key={layerId(e)} value={layerId(e)}>{e.kind==='image'?'Image '+(layers.slice(0,i+1).filter(layer=>layer.kind==='image').length):(elements.find(other=>layerId(other)===layerId(e)&&other.editText)?.editText||e.editText||e.text||'Text').replace(/\s+/g,' ').slice(0,55)}</option>)}
  </select>
  <div className="layer-order-buttons">
   <button type="button" className="button secondary" disabled={disabled||!active||layers.length<2} onClick={()=>onMove('front')}>Bring to Front</button>
   <button type="button" className="button secondary" disabled={disabled||!active||layers.length<2} onClick={()=>onMove('back')}>Send to Back</button>
  </div>
 </div>;
}
