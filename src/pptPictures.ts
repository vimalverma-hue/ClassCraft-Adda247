// Legacy PPT stores OfficeArt bitmap records in the OLE Pictures stream.
export async function legacyPictures(bytes:Uint8Array){
 const CFB=await import('cfb');const file=CFB.read(bytes,{type:'array'});const entry=file.FileIndex.find(e=>e.name==='Pictures');if(!entry?.content)return[];const data=new Uint8Array(entry.content);const view=new DataView(data.buffer,data.byteOffset,data.byteLength);const pictures:{name:string;bytes:Uint8Array}[]=[];
 for(let pos=0;pos+8<=data.length;){const type=view.getUint16(pos+2,true),length=view.getUint32(pos+4,true),end=pos+8+length;if(end>data.length||end<=pos)break;if(type>=0xf01a&&type<=0xf117){let start=-1,ext='';for(let i=pos+8;i<Math.min(end,pos+96);i++){if(data[i]===137&&data[i+1]===80&&data[i+2]===78&&data[i+3]===71){start=i;ext='png';break;}if(data[i]===255&&data[i+1]===216&&data[i+2]===255){start=i;ext='jpg';break;}}if(start>=0)pictures.push({name:`PowerPoint-image-${pictures.length+1}.${ext}`,bytes:data.slice(start,end)});}pos=end;}
 return pictures;
}
