import {it,expect} from 'vitest';
import fs from 'node:fs';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {keywordPadding,keywordMetrics} from '../src/keywordPadding';
import {keywordBackgrounds} from '../src/keywordBackgrounds';
import {exportDeck} from '../src/exporter';
import {blankSlide,newProject,type TemplateSet} from '../src/model';

GlobalFonts.registerFromPath('public/fonts/kokilab.ttf','Kokila');GlobalFonts.registerFromPath('public/fonts/mangalb.ttf','Mangal');
async function withFonts(run:()=>void|Promise<void>){const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>createCanvas(1,1)};try{await run();}finally{(globalThis as any).document=prior;}}
it('pads actual Hindi glyphs equally and retains room for lower vowel marks',async()=>withFonts(()=>{
 const ordinary=keywordMetrics('से किस','Kokila',26,true),lower=keywordMetrics('भूमि','Kokila',26,true),box=keywordPadding('से किस','Kokila',26,true),lowerBox=keywordPadding('भूमि','Kokila',26,true);
 expect(box.height).toBeCloseTo(ordinary.ascent+ordinary.descent+2*ordinary.pad);expect(box.bottom).toBeGreaterThan(14);expect(box.height).toBeLessThan(ordinary.fontAscent+ordinary.fontDescent);
 expect(lower.descent).toBeGreaterThan(ordinary.descent);expect(lowerBox.height).toBeGreaterThan(box.height);expect(lowerBox.bottom).toBeLessThan(box.bottom);
}));
it('separates multiline highlight backgrounds while preserving aligned text geometry',async()=>withFonts(()=>{
 const e={id:'q',kind:'text' as const,x:80,y:160,w:1400,h:300,size:26,font:'Kokila',bold:true,lineHeight:1.35,align:'right' as const,lines:['से किस','राज्य'],highlight:'से किस राज्य',highlightColor:'#46ef5a'};
 const before=structuredClone(e),boxes=keywordBackgrounds(e);expect(boxes).toHaveLength(2);expect(boxes[1].y).toBeGreaterThan(boxes[0].y);expect(boxes.every(box=>Math.abs(box.x+box.w-(e.x+e.w))<3)).toBe(true);expect(e).toEqual(before);
 const repeated=keywordBackgrounds({...e,lines:['से किस','से किस','से किस'],highlight:'से किस'});expect(repeated[2].y-repeated[0].y).toBeCloseTo(2*26*1.35*2,6);
}));
it('exports fitted backgrounds behind fully editable Hindi/English text without native highlight cells',async()=>withFonts(async()=>{
 const p=newProject();p.theme.mode='custom';p.style.highlightColor='#46ef5a';p.style.size=26;p.slides=[];
 for(const font of ['Kokila','Mangal'])for(const word of ['से किस','भूमि','gyp'])p.slides.push({...blankSlide(),layout:'mcq',optionsMode:'vertical',style:{font,bold:true,highlight:word},text:`Q.1 यह ${word} शब्द है।\nThis is a teaching question.\nA) First\nB) Second\nC) Third\nD) Fourth`});
 const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
 const bytes=await(await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false},()=>{})).arrayBuffer(),zip=await JSZip.loadAsync(bytes);
 for(let i=0;i<p.slides.length;i++){const xml=await zip.file(`ppt/slides/slide${i+1}.xml`)!.async('string'),doc=new JSDOM(xml,{contentType:'text/xml'}).window.document;expect(xml).not.toContain('<a:highlight>');expect(xml).toContain('ClassSlide Keyword Highlight question');expect(xml).toContain(p.slides[i].style.highlight);const shapes=[...doc.getElementsByTagNameNS('*','sp')],rectangle=shapes.findIndex(shape=>shape.getElementsByTagNameNS('*','cNvPr')[0]?.getAttribute('name')?.startsWith('ClassSlide Keyword Highlight')),question=shapes.findIndex(shape=>shape.textContent?.includes('teaching question'));expect(rectangle).toBeLessThan(question);expect(shapes[question].getElementsByTagNameNS('*','t').length).toBeGreaterThan(0);}
 fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/keyword-fitted-padding.pptx',Buffer.from(bytes));
}));
