import {it,expect,vi} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {exportDeck} from '../src/exporter';
import {restoreRasterFontSizes} from '../src/slideRaster';
import {resolveSlide} from '../src/layout';
import {blankSlide,newProject,type TemplateSet} from '../src/model';

const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
it('preserves paragraph/header line heights, transparent table rows and explicit table wrapping in native PPT',async()=>{
 vi.stubGlobal('document',{fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})});
 try{
  const p=newProject();p.theme.mode='custom';p.style.font='Kokila';p.style.size=28;p.style.lineHeight=1.35;
  p.slides=[{...blankSlide(),layout:'steps',text:'पहली पंक्ति: सामग्री\nSecond line of teaching material\nतीसरी पंक्ति: संविधान\nFourth line of teaching material'},
   {...blankSlide(),layout:'table',blocks:[{id:'table',kind:'table',text:'',answer:'',group:0,rows:[['विषय / Topic','विवरण / Details'],['भारत / India','नई दिल्ली / New Delhi'],['Lesson','A wrapped paragraph with information for students, followed by more words to fill the row.']]}]}];
  const zip=await JSZip.loadAsync(await(await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false},()=>{})).arrayBuffer());
  const doc=new JSDOM(await zip.file('ppt/slides/slide1.xml')!.async('string'),{contentType:'text/xml'}).window.document;
  for(const e of resolveSlide(p,p.slides[0],templates,0).elements.filter(e=>e.kind==='text')){
   const tag=[...doc.getElementsByTagNameNS('*','cNvPr')].find(n=>n.getAttribute('name')==='ClassSlide Text '+e.id)!,shape=tag.parentElement!.parentElement!;
   expect(shape.getElementsByTagNameNS('*','bodyPr')[0].getAttribute('wrap')).toBe('none');
   for(const spacing of shape.getElementsByTagNameNS('*','lnSpc'))expect(spacing.getElementsByTagNameNS('*','spcPts')[0].getAttribute('val')).toBe(String(Math.round((e.size||p.style.size)*(e.lineHeight||1.35)*100)));
  }
  const table=new JSDOM(await zip.file('ppt/slides/slide2.xml')!.async('string'),{contentType:'text/xml'}).window.document;
  const cells=[...table.getElementsByTagNameNS('*','tc')];expect(cells).toHaveLength(6);
  for(const [index,cell] of cells.entries()){
   const props=cell.getElementsByTagNameNS('*','tcPr')[0],fill=[...props.children].find(n=>n.localName==='solidFill')!;
   expect(fill.getElementsByTagNameNS('*','alpha')[0]?.getAttribute('val')||'100000').toBe(index<2?'100000':'0');
   expect(props.getElementsByTagNameNS('*','lnL')[0].getAttribute('w')).toBe('12700');
   for(const spacing of cell.getElementsByTagNameNS('*','lnSpc'))expect(spacing.getElementsByTagNameNS('*','spcPts')[0].getAttribute('val')).toBe('3780');
  }
  expect(cells[5].getElementsByTagNameNS('*','p').length).toBeGreaterThan(1);
 }finally{vi.unstubAllGlobals();}
});

it('restores exact font sizes in SVG captures without removing embedded TTF font faces',()=>{
 const dom=new JSDOM('');vi.stubGlobal('DOMParser',dom.window.DOMParser);vi.stubGlobal('XMLSerializer',dom.window.XMLSerializer);
 try{
  const source='<svg xmlns="http://www.w3.org/2000/svg"><style>@font-face{font-family:Kokila;src:url(data:font/ttf;base64,AAAA) format("truetype")}</style><foreignObject><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:51.9px" data-export-font-size="52px"><span style="font-size:29.9px;color:red" data-export-font-size="30.5px">हिंदी / English</span></div></foreignObject></svg>';
  const output=decodeURIComponent(restoreRasterFontSizes('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(source)).split(',')[1]);
  const doc=new dom.window.DOMParser().parseFromString(output,'image/svg+xml');expect(doc.querySelector('parsererror')).toBeNull();
  expect(doc.querySelector('div')!.getAttribute('style')).toContain('font-size: 52px');expect(doc.querySelector('span')!.getAttribute('style')).toContain('font-size: 30.5px');
  expect(output).not.toContain('data-export-font-size');expect(output).toContain('data:font/ttf;base64,AAAA');expect(output).toContain('हिंदी / English');
 }finally{vi.unstubAllGlobals();dom.window.close();}
});
