import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {timerDigits,timerNumberSize,timerFaceColor,timerRed,timerTextColor,type SlideTimer} from './timers';
const pns='http://schemas.openxmlformats.org/presentationml/2006/main';
const ans='http://schemas.openxmlformats.org/drawingml/2006/main';

export function addTimerShapes(ppt:PptxGenJS,slide:ReturnType<PptxGenJS['addSlide']>,t:SlideTimer){
 const x=t.x/144,y=t.y/144,w=t.size/144;
 const ellipse=(name:string,cx:number,cy:number,r:number,fill:string,stroke?:string)=>slide.addShape(ppt.ShapeType.ellipse,{x:x+(cx-r)/200*w,y:y+(cy-r)/200*w,w:r/100*w,h:r/100*w,fill:{color:fill},line:stroke?{color:stroke,width:t.size*.002}:{transparency:100},objectName:name});
 ellipse('ClassSlide Timer Face',100,100,98,'FFFFFF','34413C');
 slide.addShape(ppt.ShapeType.ellipse,{x:x+w*.07,y:y+w*.07,w:w*.86,h:w*.86,fill:{color:'FFFFFF',transparency:100},line:{color:timerRed.slice(1),width:t.size*.06},objectName:'ClassSlide Timer Ring'});
 // The editing view also shows an empty white track. The cover exits with the
 // first click, allowing the native wheel underneath to fill the track in red.
 slide.addShape(ppt.ShapeType.ellipse,{x:x+w*.07,y:y+w*.07,w:w*.86,h:w*.86,fill:{color:'FFFFFF',transparency:100},line:{color:'FFFFFF',width:t.size*.06},objectName:'ClassSlide Timer Ring Cover'});
 // The full-duration frame is on top in editing view; native effects reveal each
 // following second. A clear face keeps overlapping digits out of editing view.
 for(let remaining=0;remaining<=t.seconds;remaining++){
  ellipse('ClassSlide Timer Clear '+remaining,100,100,74,timerFaceColor(t).slice(1));
  slide.addText(timerDigits(remaining,t.seconds),{x:x+w*.17,y:y+w*.23,w:w*.66,h:w*.56,fontFace:'Impact',fontSize:timerNumberSize(t.seconds)*t.size/400,bold:false,align:'center',valign:'middle',margin:0,breakLine:false,color:timerTextColor(t).slice(1),objectName:'ClassSlide Timer Value '+remaining});
 }
 for(let i=0;i<40;i++){const angle=i*Math.PI/20,length=i%10===0?12:i%5===0?8:5,r=(70-length/2)/200*w,th=length/200*w,tw=w*(i%10===0?.006:.0035);slide.addShape(ppt.ShapeType.rect,{x:x+w/2+Math.sin(angle)*r-tw/2,y:y+w/2-Math.cos(angle)*r-th/2,w:tw,h:th,rotate:i*9,line:{transparency:100},fill:{color:'8D7D80'}});}
 ellipse('ClassSlide Timer Start Cap',100,14,12,timerRed.slice(1));ellipse('ClassSlide Timer Start Pin',100,14,5.4,'D8DFDC','34413C');
 // An invisible full-clock carrier gives the moving cap an exact central pivot.
 slide.addShape(ppt.ShapeType.rect,{x,y,w,h:w,line:{transparency:100},fill:{color:'FFFFFF',transparency:100},objectName:'ClassSlide Timer Orbit Box'});
 ellipse('ClassSlide Timer End Cap',100,14,12,timerRed.slice(1));ellipse('ClassSlide Timer End Pin',100,14,5.4,'D8DFDC','34413C');
}

/** One click group contains all frames; the next click reveals the answer.
 * concurrent=1 + nextAc=none avoids seeking to the end; the answer event freezes it.
 * https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.sequencetimenode
 */
export function timerSequence(start:number,frames:string[],seconds:number,ring:string,orbit:string,cover?:string){
 let id=start;const next=()=>id++,group=next(),parallel=next();
 const effect=(shape:string,visible:boolean,delay:number,click=false)=>`<p:par><p:cTn id="${next()}" presetID="1" presetClass="${visible?'entr':'exit'}" presetSubtype="0" fill="hold" nodeType="${click?'clickEffect':'withEffect'}"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="${next()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${shape}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${visible?'visible':'hidden'}"/></p:to></p:set></p:childTnLst></p:cTn></p:par>`;
 const duration=seconds*1000;
 const wheel=`<p:par><p:cTn id="${next()}" presetID="21" presetClass="entr" presetSubtype="1" fill="hold" grpId="0" nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="${next()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${ring}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set><p:animEffect transition="in" filter="wheel(1)"><p:cBhvr><p:cTn id="${next()}" dur="${duration}"/><p:tgtEl><p:spTgt spid="${ring}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>`;
 const cap=`<p:par><p:cTn id="${next()}" presetID="8" presetClass="emph" presetSubtype="0" fill="hold" grpId="0" nodeType="withEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:animRot by="21600000"><p:cBhvr><p:cTn id="${next()}" dur="${duration}" fill="hold"/><p:tgtEl><p:spTgt spid="${orbit}"/></p:tgtEl><p:attrNameLst><p:attrName>r</p:attrName></p:attrNameLst></p:cBhvr></p:animRot></p:childTnLst></p:cTn></p:par>`;
 let effects=wheel+cap+(cover?effect(cover,false,0):'')+effect(frames[0],false,1000);
 for(let elapsed=1;elapsed<=seconds;elapsed++){
  effects+=effect(frames[elapsed],true,elapsed*1000);
  if(elapsed<seconds)effects+=effect(frames[elapsed],false,(elapsed+1)*1000);
 }
 return `<p:par><p:cTn id="${group}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${parallel}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${effects}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
}

export async function addTimerAnimations(bytes:ArrayBuffer,slides:{index:number;seconds:number}[]):Promise<Blob>{
 const zip=await JSZip.loadAsync(bytes),parser=new DOMParser(),serialize=new XMLSerializer();
 for(const {index,seconds} of slides){
  const path=`ppt/slides/slide${index+1}.xml`,file=zip.file(path);if(!file)throw Error('Missing timer slide.');
  const doc=parser.parseFromString(await file.async('string'),'application/xml');
  const parse=(xml:string)=>doc.importNode(parser.parseFromString(xml,'application/xml').documentElement!,true);
  const tree=doc.getElementsByTagNameNS(pns,'spTree')[0];
  let shapeId=Math.max(...Array.from(doc.getElementsByTagNameNS(pns,'cNvPr')).map(n=>Number(n.getAttribute('id'))))+1;
  const shape=(name:string)=>{const tag=Array.from(doc.getElementsByTagNameNS(pns,'cNvPr')).find(n=>n.getAttribute('name')===name);if(!tag)throw Error('Missing timer frame.');return tag.parentNode!.parentNode! as typeof tree;};
  const carrier=shape('ClassSlide Timer Orbit Box'),transform=carrier.getElementsByTagNameNS(ans,'xfrm')[0],off=transform.getElementsByTagNameNS(ans,'off')[0],ext=transform.getElementsByTagNameNS(ans,'ext')[0];
  const x=off.getAttribute('x'),y=off.getAttribute('y'),cx=ext.getAttribute('cx'),cy=ext.getAttribute('cy');
  const groupShapes=(name:string,parts:(typeof tree)[])=>{
   const id=String(shapeId++);
   const group=parse(`<p:grpSp xmlns:p="${pns}" xmlns:a="${ans}"><p:nvGrpSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/><a:chOff x="${x}" y="${y}"/><a:chExt cx="${cx}" cy="${cy}"/></a:xfrm></p:grpSpPr></p:grpSp>`);
   tree.insertBefore(group,parts[0]);for(const part of parts)group.appendChild(part);return id;
  };
  const frames:string[]=[];
  for(let remaining=seconds;remaining>=0;remaining--)frames.push(groupShapes('ClassSlide Timer Frame '+remaining,[shape('ClassSlide Timer Clear '+remaining),shape('ClassSlide Timer Value '+remaining)]));
  const ring=shape('ClassSlide Timer Ring').getElementsByTagNameNS(pns,'cNvPr')[0].getAttribute('id')!;
  const cover=shape('ClassSlide Timer Ring Cover').getElementsByTagNameNS(pns,'cNvPr')[0].getAttribute('id')!;
  const orbit=groupShapes('ClassSlide Timer Orbit',[carrier,shape('ClassSlide Timer End Cap'),shape('ClassSlide Timer End Pin')]);
  let timing=doc.getElementsByTagNameNS(pns,'timing')[0];
  if(!timing){
   timing=parse(`<p:timing xmlns:p="${pns}"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="none"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst/></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst/></p:timing>`) as typeof timing;
   const ext=Array.from(doc.documentElement!.childNodes).find(n=>n.nodeName==='p:extLst');doc.documentElement!.insertBefore(timing,ext||null);
  }
  const nodes=Array.from(timing.getElementsByTagNameNS(pns,'cTn')),main=nodes.find(n=>n.getAttribute('nodeType')==='mainSeq');if(!main)throw Error('Missing slide click sequence.');
  (main.parentNode as typeof main).setAttribute('nextAc','none');(main.parentNode as typeof main).setAttribute('concurrent','1');
  const children=main.getElementsByTagNameNS(pns,'childTnLst')[0],first=Math.max(...nodes.map(n=>Number(n.getAttribute('id'))||0))+1;
  const sequence=parse(`<root xmlns:p="${pns}">${timerSequence(first,frames,seconds,ring,orbit,cover)}</root>`);
  // Stop at the answer's actual begin event, retaining the current ring angle
  // and number rather than seeking to zero or resetting the timer.
  // https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.endconditionlist
  const answer=nodes.find(n=>n.getAttribute('nodeType')==='clickEffect');
  if(answer){
   const timer=sequence.getElementsByTagNameNS(pns,'cTn')[0];
   const end=parse(`<p:endCondLst xmlns:p="${pns}"><p:cond evt="onBegin" delay="0"><p:tn val="${answer.getAttribute('id')}"/></p:cond></p:endCondLst>`);
   timer.insertBefore(end,timer.getElementsByTagNameNS(pns,'childTnLst')[0]);
   // PowerPoint's freeze resets when a sibling click starts. Hold retains the
   // interrupted values while mainSeq remains active (MS-OE376 2.1.1233).
   for(const node of [timer,...Array.from(timer.getElementsByTagNameNS(pns,'cTn'))])node.setAttribute('fill','hold');
  }
  children.insertBefore(sequence.firstChild!,children.firstChild);
  let builds=timing.getElementsByTagNameNS(pns,'bldLst')[0];if(!builds){builds=doc.createElementNS(pns,'p:bldLst');timing.appendChild(builds);}
  for(const id of [...frames,ring,orbit,cover]){const build=doc.createElementNS(pns,'p:bldP');build.setAttribute('spid',id);build.setAttribute('grpId','0');build.setAttribute('animBg','1');builds.appendChild(build);}
  zip.file(path,serialize.serializeToString(doc));
 }
 return zip.generateAsync({type:'blob',compression:'DEFLATE'});
}
