import type {Asset,ImageCrop,ImagePlacement,Slide} from './model';
export type Box={x:number;y:number;w:number;h:number};
export type ResizeCorner='nw'|'ne'|'sw'|'se';
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const finite=(value:number|undefined,fallback:number)=>Number.isFinite(value)?value!:fallback;
export function imageCrop(value?:ImageCrop):ImageCrop{
 const w=clamp(finite(value?.w,1),.02,1),h=clamp(finite(value?.h,1),.02,1);
 return{x:clamp(finite(value?.x,0),0,1-w),y:clamp(finite(value?.y,0),0,1-h),w,h};
}
export function normalizeImage(value:ImagePlacement):ImagePlacement{
 const w=clamp(finite(value.w,560),40,1920),h=clamp(finite(value.h,400),40,1080);
 return{x:clamp(finite(value.x,1280),0,1920-w),y:clamp(finite(value.y,220),0,1080-h),w,h,fit:value.fit==='cover'?'cover':'contain',crop:imageCrop(value.crop)};
}
export function thumbnailImage():ImagePlacement{return{x:0,y:0,w:1920,h:1080,fit:'contain',crop:imageCrop()};}
export function defaultImage(s:Slide,asset:Asset):ImagePlacement{
 if(s.fixedSlot==='thumbnail'||s.kind==='original'&&s.templateIndex===1)return thumbnailImage();
 const ratio=asset.width/asset.height,w=Math.min(640,540*ratio),h=w/ratio;
 return normalizeImage({x:1840-w,y:220,w,h,fit:'contain'});
}
/** Visible picture bounds plus the effective crop, shared by preview and PPTX. */
export function imageView(frame:ImagePlacement,width:number,height:number){
 const crop=imageCrop(frame.crop),ratio=width*crop.w/(height*crop.h),target=frame.w/frame.h;
 let {x,y,w,h}=frame;
 if(frame.fit==='contain'){
  if(ratio>target){h=w/ratio;y+=(frame.h-h)/2;}else{w=h*ratio;x+=(frame.w-w)/2;}
 }else if(ratio>target){const next=crop.h*height/width*target;crop.x+=(crop.w-next)/2;crop.w=next;}
 else{const next=crop.w*width/height/target;crop.y+=(crop.h-next)/2;crop.h=next;}
 return{x,y,w,h,crop};
}
export function moveImageBox(start:Box,mode:'move'|ResizeCorner,dx:number,dy:number,width=1920,height=1080,keepRatio=true,min=40):Box{
 if(mode==='move')return{...start,x:clamp(start.x+dx,0,width-start.w),y:clamp(start.y+dy,0,height-start.h)};
 const left=mode.includes('w'),top=mode.includes('n'),ax=left?start.x+start.w:start.x,ay=top?start.y+start.h:start.y;
 if(keepRatio){
  const sx=(left?-dx:dx)/start.w,sy=(top?-dy:dy)/start.h;
  const max=Math.min((left?ax:width-ax)/start.w,(top?ay:height-ay)/start.h),minimum=Math.min(max,Math.max(min/start.w,min/start.h));
  const scale=clamp(1+(Math.abs(sx)>Math.abs(sy)?sx:sy),minimum,max),w=start.w*scale,h=start.h*scale;
  return{x:left?ax-w:ax,y:top?ay-h:ay,w,h};
 }
 const w=clamp(start.w+(left?-dx:dx),min,left?ax:width-ax),h=clamp(start.h+(top?-dy:dy),min,top?ay:height-ay);
 return{x:left?ax-w:ax,y:top?ay-h:ay,w,h};
}
