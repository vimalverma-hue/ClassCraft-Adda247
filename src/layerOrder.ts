import type {Element,Project,Slide} from './model';
import {fixedSlot} from './classSlides';

export type LayerDirection='front'|'back';
export function isSlideLayer(e:Element){return e.id!=='answer-reveal'&&(!!e.imageSize||['text','table','equation'].includes(e.kind));}
export function layerId(e:Element){return e.id.startsWith('theory-bullet-')?e.id.replace('theory-bullet-','theory-item-'):e.editId||e.id;}
export function layerIds(elements:Element[]){return [...new Set(elements.filter(isSlideLayer).map(layerId))];}
/** Keep backgrounds and presentation overlays in their existing slots. */
export function orderedElements(elements:Element[],order?:string[]):Element[]{
 if(!order?.length)return elements;
 const present=layerIds(elements),ids=[...order.filter(id=>present.includes(id)),...present.filter(id=>!order.includes(id))],rank=new Map(ids.map((id,i)=>[id,i]));
 const sorted=elements.filter(isSlideLayer).sort((a,b)=>rank.get(layerId(a))!-rank.get(layerId(b))!);
 let index=0;return elements.map(e=>isSlideLayer(e)?sorted[index++]:e);
}
export function moveLayerOrder(p:Project,selected:string,all:boolean,id:string,direction:LayerDirection,elements:(s:Slide,index:number)=>Element[]):Project{
 const current=p.slides.find(s=>s.id===selected);if(!current)return p;
 const bulk=all&&!fixedSlot(current);let changed=false;
 const slides=p.slides.map((s,index)=>{
  if(!(bulk?!fixedSlot(s):s.id===selected)||s.locked)return s;
  const content=elements(s,index),ids=layerIds(content);
  if(!ids.includes(id)||s.lockedElements.some(key=>key===id||content.some(e=>e.id===key&&layerId(e)===id)))return s;
  const rest=ids.filter(key=>key!==id),order=direction==='front'?[...rest,id]:[id,...rest];
  if(order.every((key,i)=>key===ids[i]))return s;
  changed=true;return{...s,layerOrder:order,manual:true};
 });
 return changed?{...p,slides}:p;
}
export function forgetLayerOrder(s:Slide,id:string){return s.layerOrder?{layerOrder:s.layerOrder.filter(key=>key!==id)}:{};}
export function validateLayerOrder(order:unknown){
 if(order===undefined)return;
 if(!Array.isArray(order)||order.some(id=>typeof id!=='string'||!id)||new Set(order).size!==order.length)throw Error('Invalid slide layer order.');
}
