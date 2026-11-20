import {toSvg} from 'html-to-image';

/** Preserve fractional sizes: html-to-image otherwise floors every font and
 * subtracts 0.1px, changing Hindi shaping, wrapping and highlight alignment. */
export function restoreRasterFontSizes(svg:string):string{
 const doc=new DOMParser().parseFromString(decodeURIComponent(svg.slice(svg.indexOf(',')+1)),'image/svg+xml');
 for(const element of doc.querySelectorAll('[data-export-font-size]')){
  const size=element.getAttribute('data-export-font-size')!;
  if(/^\d+(?:\.\d+)?px$/.test(size))(element as HTMLElement).style.setProperty('font-size',size);
  element.removeAttribute('data-export-font-size');
 }
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(doc));
}

export async function rasterizeSlide(element:HTMLElement):Promise<string>{
 for(const node of [element,...element.querySelectorAll('*')])node.setAttribute('data-export-font-size',getComputedStyle(node).fontSize);
 // Do not restrict to WOFF2: the teacher-supplied Kokila/Mangal/Aptos are TTF.
 const svg=restoreRasterFontSizes(await toSvg(element,{width:1920,height:1080,cacheBust:false}));
 const image=new Image();image.src=svg;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
 const context=canvas.getContext('2d');if(!context)throw Error('Could not render the slide image.');
 context.drawImage(image,0,0);return canvas.toDataURL('image/png');
}
