const rgb=(c:string)=>c.replace('#','').match(/.{2}/g)!.map(v=>parseInt(v,16));
export function contrastRatio(a:string,b:string){const luminance=(c:string)=>rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
/** Keep the selected hue where possible; adjust brightness only when contrast requires it. */
export function readableColour(selected:string,background:string,min=4.5){
 if(!/^#[\da-f]{6}$/i.test(selected)||!/^#[\da-f]{6}$/i.test(background))return selected;
 if(contrastRatio(selected,background)>=min)return selected;
 const target=contrastRatio('#ffffff',background)>contrastRatio('#000000',background)?255:0,base=rgb(selected);
 for(let step=1;step<=255;step++){const colour='#'+base.map(v=>Math.round(v+(target-v)*step/255).toString(16).padStart(2,'0')).join('');if(contrastRatio(colour,background)>=min)return colour;}
 return target?'#ffffff':'#000000';
}
