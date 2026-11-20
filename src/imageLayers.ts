import {forgetLayerOrder} from './layerOrder';
import {uid,type Asset,type Project,type Slide,type SlideImage,type ImagePlacement} from './model';
import {fixedSlot} from './classSlides';
import {defaultImage,normalizeImage,thumbnailImage} from './slideImages';

export function slideImages(s:Slide):{id:string;assetId:string;placement?:ImagePlacement}[]{
 return [...(s.image?[{id:'content-image',assetId:s.image,placement:s.imagePlacement}]:[]),...(s.images||[])];
}
export function addSlideImage(p:Project,selected:string,all:boolean,asset:Asset){
 const current=p.slides.find(s=>s.id===selected);if(!current)return{project:p,elementId:''};
 const bulk=all&&fixedSlot(current)!=='thumbnail',targets=p.slides.filter(s=>bulk?!fixedSlot(s):s.id===selected);
 const legacy=(!bulk&&!!fixedSlot(current))||targets.every(s=>!slideImages(s).length),elementId=legacy?'content-image':'image-'+uid();
 const reference=targets.find(s=>s.id===selected)||targets[0]||current,offset=(slideImages(reference).length%8)*32,base=defaultImage(reference,asset),shared=normalizeImage({...base,x:base.x-offset,y:base.y+offset});
 const project:Project={...p,assets:{...p.assets,[asset.id]:asset},slides:p.slides.map(s=>{
  if(!targets.some(target=>target.id===s.id))return s;
  const placement=legacy?defaultImage(s,asset):structuredClone(shared);
  return legacy?{...s,image:asset.id,imagePlacement:placement,manual:true}:{...s,images:[...(s.images||[]),{id:elementId,assetId:asset.id,placement}],manual:true};
 })};
 return{project,elementId};
}
export function changeSlideImage(p:Project,selected:string,all:boolean,id:string,value?:ImagePlacement):Project{
 const current=p.slides.find(s=>s.id===selected);if(!current)return p;
 const bulk=all&&fixedSlot(current)!=='thumbnail';
 return{...p,slides:p.slides.map(s=>{
  if(!(bulk?!fixedSlot(s):s.id===selected)||!slideImages(s).some(layer=>layer.id===id))return s;
  const placement=value?(fixedSlot(s)==='thumbnail'?thumbnailImage():normalizeImage(value)):undefined;
  if(id==='content-image')return{...s,image:placement?s.image:undefined,imagePlacement:placement,manual:true,...(!placement?{...forgetLayerOrder(s,id),lockedElements:s.lockedElements.filter(key=>key!==id)}:{})};
  return{...s,images:placement?s.images!.map(layer=>layer.id===id?{...layer,placement}:layer):s.images!.filter(layer=>layer.id!==id),manual:true,...(!placement?{...forgetLayerOrder(s,id),lockedElements:s.lockedElements.filter(key=>key!==id)}:{})};
 })};
}
export function validateSlideImages(value:unknown):asserts value is SlideImage[]|undefined{
 if(value===undefined)return;if(!Array.isArray(value))throw Error('Invalid image layers.');
 const ids=new Set<string>();for(const layer of value){
  const p=layer?.placement,c=p?.crop;
  if(!layer||typeof layer.id!=='string'||!layer.id.startsWith('image-')||ids.has(layer.id)||typeof layer.assetId!=='string'||!layer.assetId||!p||!['x','y','w','h'].every(key=>typeof p[key]==='number'&&Number.isFinite(p[key]))||p.w<=0||p.h<=0||!['cover','contain'].includes(p.fit)||(c&&!['x','y','w','h'].every(key=>typeof c[key]==='number'&&Number.isFinite(c[key]))))throw Error('Invalid image layer.');
  ids.add(layer.id);
 }
}
