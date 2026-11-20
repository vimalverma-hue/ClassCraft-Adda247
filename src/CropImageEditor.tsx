import {useRef,useState,type PointerEvent} from 'react';
import type {Asset,ImageCrop} from './model';
import {imageCrop,moveImageBox,type ResizeCorner} from './slideImages';

export function CropImageEditor({asset,crop,thumbnail,onApply,onCancel}:{asset:Asset;crop:ImageCrop;thumbnail:boolean;onApply:(crop:ImageCrop)=>void;onCancel:()=>void}){
 const [value,setValue]=useState(imageCrop(crop)),stage=useRef<HTMLDivElement>(null),drag=useRef<{pointer:number;x:number;y:number;w:number;h:number;original:ImageCrop;mode:'move'|ResizeCorner}|null>(null);
 const begin=(event:PointerEvent,mode:'move'|ResizeCorner)=>{
  if(event.button!==0||drag.current)return;event.preventDefault();event.stopPropagation();const rect=stage.current!.getBoundingClientRect();
  drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,w:rect.width,h:rect.height,original:value,mode};stage.current!.setPointerCapture(event.pointerId);
 };
 const move=(event:PointerEvent)=>{const start=drag.current!;return moveImageBox(start.original,start.mode,(event.clientX-start.x)/start.w,(event.clientY-start.y)/start.h,1,1,thumbnail,.02);};
 const reset=()=>{if(!thumbnail){setValue(imageCrop());return;}const ratio=16/9*asset.height/asset.width,w=Math.min(1,ratio),h=w/ratio;setValue({x:(1-w)/2,y:(1-h)/2,w,h});};
 return <>
  <div ref={stage} className="crop-stage" style={{width:Math.min(620,400*asset.width/asset.height),maxWidth:'100%',aspectRatio:asset.width/asset.height,position:'relative',overflow:'hidden',touchAction:'none',margin:'12px auto'}}
   onPointerMove={event=>{if(drag.current?.pointer===event.pointerId)setValue(move(event));}}
   onPointerUp={event=>{if(drag.current?.pointer!==event.pointerId)return;setValue(move(event));drag.current=null;stage.current!.releasePointerCapture(event.pointerId);}}
   onPointerCancel={()=>{if(drag.current)setValue(drag.current.original);drag.current=null;}}
   onLostPointerCapture={()=>{drag.current=null;}}>
   <img src={asset.data} alt="Image to crop" draggable={false} style={{display:'block',width:'100%',height:'100%',pointerEvents:'none'}}/>
   <div role="group" aria-label="Crop selection" tabIndex={0} style={{position:'absolute',left:value.x*100+'%',top:value.y*100+'%',width:value.w*100+'%',height:value.h*100+'%',border:'2px solid #fff',boxShadow:'0 0 0 9999px #0009',cursor:'move'}} onPointerDown={event=>begin(event,'move')}
    onKeyDown={event=>{const steps:Record<string,[number,number]>={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]};const delta=steps[event.key];if(delta){event.preventDefault();setValue(moveImageBox(value,'move',delta[0],delta[1],1,1,thumbnail,.02));}}}>
    {(['nw','ne','sw','se'] as const).map(corner=><div key={corner} role="button" aria-label={'Crop corner '+corner} onPointerDown={event=>begin(event,corner)} style={{position:'absolute',width:16,height:16,border:'2px solid var(--action-accent)',background:'#fff',left:corner.includes('w')?-5:undefined,right:corner.includes('e')?-5:undefined,top:corner.includes('n')?-5:undefined,bottom:corner.includes('s')?-5:undefined,cursor:corner==='nw'||corner==='se'?'nwse-resize':'nesw-resize'}}/>)}
   </div>
  </div>
  <div className="modal-actions"><button className="button secondary" onClick={reset}>Reset crop</button><button className="button secondary" onClick={onCancel}>Cancel</button><button className="button primary" onClick={()=>onApply(value)}>Apply crop</button></div>
 </>;
}
