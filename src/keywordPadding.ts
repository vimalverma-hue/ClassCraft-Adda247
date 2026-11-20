/** Bounds relative to the text baseline; padding never participates in text layout. */
export type KeywordPadding={height:number;bottom:number;side:number};
let canvas:HTMLCanvasElement|undefined;
export function keywordMetrics(text:string,font:string,size:number,bold:boolean){
 const pixels=size*2,pad=Math.max(1.5,pixels*.04),side=Math.max(1.5,pixels*.045);
 let ascent=pixels*.8,descent=pixels*.18,fontDescent=pixels*.25;
 let fontAscent=pixels*.95,width=[...text].length*pixels*.54;
 if(typeof document!=='undefined'){
  if(!canvas||canvas.ownerDocument!==document)canvas=document.createElement('canvas');
  const context=canvas.getContext('2d');
  if(context){
   context.font=`${bold?700:400} ${pixels}px "${font}", "Noto Sans", sans-serif`;
   const metrics=context.measureText(text);
   if(Number.isFinite(metrics.actualBoundingBoxAscent)&&Number.isFinite(metrics.actualBoundingBoxDescent)){
    ascent=metrics.actualBoundingBoxAscent;descent=metrics.actualBoundingBoxDescent;
   }
   if(Number.isFinite(metrics.width))width=metrics.width;
   if(Number.isFinite(metrics.fontBoundingBoxAscent))fontAscent=metrics.fontBoundingBoxAscent;
   if(Number.isFinite(metrics.fontBoundingBoxDescent))fontDescent=metrics.fontBoundingBoxDescent;
  }
 }
 return{ascent,descent,fontAscent,fontDescent,width,pad,side};
}
export function keywordPadding(text:string,font:string,size:number,bold:boolean):KeywordPadding{
 const {ascent,descent,fontDescent,pad,side}=keywordMetrics(text,font,size,bold);
 return{height:Math.max(pad*2,ascent+descent+pad*2),bottom:fontDescent-descent-pad,side};
}
