import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {newProject,blankSlide,type TemplateSet} from '../src/model';
import {createTheorySlides,theoryContent,pairedTheoryText} from '../src/theory';
import {generateSlides,contentGeometry} from '../src/parser';
import {resolveSlide} from '../src/layout';
import {pptxText} from '../src/contentFiles';
import {exportDeck} from '../src/exporter';

const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
const compact=(text:string)=>text.replace(/\s+/g,'');
const body=(slides:ReturnType<typeof createTheorySlides>['slides'])=>slides.flatMap(theoryContent).join(' ');
function checkFit(p:ReturnType<typeof newProject>,slides:ReturnType<typeof createTheorySlides>['slides']){
 for(const slide of slides){const resolved=resolveSlide(p,slide,templates,0),g=contentGeometry(p,slide);expect(resolved.warnings).toEqual([]);for(const e of resolved.elements.filter(e=>e.id.startsWith('theory-item-'))){expect(e.size).toBe(p.style.size);expect(e.y+e.h).toBeLessThanOrEqual(g.y+g.h+1);}}
}

it('reconstructs one-word and broken OCR lines into a complete paragraph instead of heading-only slides',()=>{
 const text='संविधान देश का सर्वोच्च कानून है। यह शासन की संरचना और नागरिकों के अधिकार निर्धारित करता है।';
 for(const separator of ['\n','\n\n','\n\n---\n\n']){
  const p=newProject();p.source=text.split(' ').join(separator);const before=p.source;
  const slides=createTheorySlides(p,'theory-paragraphs').slides;
  expect(slides).toHaveLength(1);expect(slides[0].theory?.title).toBe('');expect(compact(body(slides))).toBe(compact(text));expect(p.source).toBe(before);checkFit(p,slides);
 }
});

it('packs more than six short bullet points when the measured space allows it',()=>{
 const p=newProject();p.source='# Key points\n\n'+Array.from({length:15},(_,i)=>`- Point ${i+1}.`).join('\n');
 const slides=createTheorySlides(p,'theory-bullets').slides;
 expect(theoryContent(slides[0]).length).toBeGreaterThan(6);
 const g=contentGeometry(p,slides[0]),elements=resolveSlide(p,slides[0],templates,0).elements.filter(e=>e.id.startsWith('theory-item-'));
 expect((Math.max(...elements.map(e=>e.y+e.h))-g.y)/g.h).toBeGreaterThan(.85);
 for(let i=1;i<=15;i++)expect(body(slides).match(new RegExp('Point '+i+'\\.','g'))).toHaveLength(1);checkFit(p,slides);
});

it('uses remaining slide space for long prose and preserves every word at the selected font size',()=>{
 const p=newProject(),long=Array.from({length:110},(_,i)=>'detail'+i).join(' ')+'.';
 p.source='# Lesson\n\nA short introductory point.\n\n'+long;
 const slides=createTheorySlides(p,'theory-paragraphs').slides;
 expect(slides.length).toBeGreaterThan(1);expect(slides[0].text).toContain('detail0');
 expect(compact(body(slides))).toBe(compact('A short introductory point. '+long));checkFit(p,slides);
});

it('combines repeated imported topics while starting genuinely different headings on a new slide',()=>{
 const p=newProject();p.source='# Photosynthesis\n\nPlants use light to prepare food.\n\n---\n\n# Photosynthesis (continued)\n\nChlorophyll absorbs light.\n\n---\n\n# Respiration\n\nCells release energy from food.';
 const slides=createTheorySlides(p,'theory-bullets').slides;
 expect(slides).toHaveLength(2);expect(slides[0].theory?.title).toBe('Photosynthesis');expect(slides[0].text).toContain('Chlorophyll');expect(slides[1].theory?.title).toBe('Respiration');expect(slides[1].text).not.toContain('Chlorophyll');checkFit(p,slides);
});

it('recognizes ordinary Hindi and English topic headings without treating short fragments as separate pages',()=>{
 const p=newProject();p.source='प्रकाश संश्लेषण\n\nपौधे सूर्य के प्रकाश से भोजन बनाते हैं।\n\nश्वसन\n\nकोशिकाएँ भोजन से ऊर्जा प्राप्त करती हैं।';
 const slides=createTheorySlides(p,'theory-paragraphs').slides;
 expect(slides.map(s=>s.theory?.title)).toEqual(['प्रकाश संश्लेषण','श्वसन']);checkFit(p,slides);
 p.source='Photosynthesis\n\nPlants use light to prepare food.\n\n---\n\nPhotosynthesis (continued)\n\nChlorophyll absorbs light energy in leaves.\n\nRespiration\n\nCells release energy from food.';
 const english=createTheorySlides(p,'theory-paragraphs').slides;
 expect(english.map(s=>s.theory?.title)).toEqual(['Photosynthesis','Respiration']);expect(english[0].text).toContain('Chlorophyll');checkFit(p,english);
});

it('preserves paired Hindi/English bullets and wrapped list continuations',()=>{
 const p=newProject();p.source='# अधिकार / Rights\n\n- सभी नागरिक\nकानून के समक्ष समान हैं।\nAll citizens are equal before the law.\n\n- प्रत्येक व्यक्ति स्वतंत्र है। / Every person is free.';
 const slides=createTheorySlides(p,'theory-bullets').slides,pairs=slides.flatMap(theoryContent).map(pairedTheoryText);
 expect(pairs).toEqual([{primary:'सभी नागरिक कानून के समक्ष समान हैं।',secondary:'All citizens are equal before the law.'},{primary:'प्रत्येक व्यक्ति स्वतंत्र है।',secondary:'Every person is free.'}]);checkFit(p,slides);
});

it('packs actual PPT text boxes and OCR output across imported slide boundaries',async()=>{
 const deck=new PptxGenJS();deck.layout='LAYOUT_WIDE';
 for(const text of ['The','Constitution','protects','citizens.'])deck.addSlide().addText(text,{x:1,y:1,w:8,h:1,fontSize:24});
 const bytes=await deck.write({outputType:'arraybuffer'}) as ArrayBuffer;
 const extracted=await pptxText(await JSZip.loadAsync(bytes)),p=newProject();p.source=extracted.text;
 const slides=createTheorySlides(p,'theory-paragraphs').slides;expect(slides).toHaveLength(1);expect(slides[0].text).toBe('The Constitution protects citizens.');
 const imageDeck=new PptxGenJS();imageDeck.layout='LAYOUT_WIDE';imageDeck.addSlide().addImage({data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=',x:0,y:0,w:10,h:5});
 const imageBytes=await imageDeck.write({outputType:'arraybuffer'}) as ArrayBuffer;
 const ocr=await pptxText(await JSZip.loadAsync(imageBytes),async()=> 'भारत\n\nका\n\nसंविधान\n\nसर्वोच्च\n\nकानून\n\nहै।');p.source=ocr.text;
 expect(createTheorySlides(p,'theory-bullets').slides).toHaveLength(1);
});

it('uses the same theory analysis in the mixed-content formatter without swallowing MCQs',()=>{
 const p=newProject();p.includeWelcome=false;p.includeClosing=false;p.source='The\n\nConstitution\n\nprotects\n\ncitizens.\n\nQ.1 Capital?\nA) Delhi\nB) Mumbai\nAnswer: A';
 const slides=generateSlides(p);expect(slides.filter(s=>s.layout==='theory')).toHaveLength(1);expect(slides.filter(s=>s.layout==='mcq')).toHaveLength(1);expect(body(slides.filter(s=>s.layout==='theory'))).toBe('The Constitution protects citizens.');
});

it('exports dense theory with original font sizes and editable content for PowerPoint review',async()=>{
 const old=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const p=newProject();p.theme.mode='custom';p.style.font='Mangal';p.source='# नागरिक अधिकार / Citizens’ rights\n\n'+Array.from({length:9},(_,i)=>`- बिंदु ${i+1}: सभी नागरिक कानून के समक्ष समान हैं। / Point ${i+1}: All citizens are equal before the law.`).join('\n');
  p.slides=createTheorySlides(p,'theory-bullets',{...blankSlide(),reserve:'right',reserveWidth:300}).slides;checkFit(p,p.slides);
  const blob=await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:false},()=>{});
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/theory-packed.pptx',Buffer.from(await blob.arrayBuffer()));
 }finally{(globalThis as any).document=old;}
});
