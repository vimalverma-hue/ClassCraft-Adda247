import {it,expect,beforeAll,afterAll,vi} from 'vitest';
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {createWorker,type Worker} from 'tesseract.js';
import {createCanvas} from '@napi-rs/canvas';
import {pdfOcr} from '../src/ocrContent';
import {needsOcr} from '../src/ocr';
import {officeZip,pptxText} from '../src/contentFiles';
import {legacyPictures} from '../src/pptPictures';
import {extractMCQs} from '../src/mcq';
import {createTheorySlides} from '../src/theory';
import {newProject} from '../src/model';
let worker:Worker;
beforeAll(async()=>{worker=await createWorker('hin+eng',1,{langPath:path.resolve('public/readers/ocr/lang'),cacheMethod:'none'});},30000);
afterAll(async()=>{await worker?.terminate();});
const assets={workerSrc:pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href,base:path.resolve('node_modules/pdfjs-dist').replaceAll('\\','/')+'/'};
const read=async(bytes:Uint8Array)=>{const result=await worker.recognize(bytes);return result.data.text;};
it('extracts Hindi and English MCQ/options/answer and theory from actual image-only PPTX',async()=>{
 const result=await pptxText(await officeZip(new Uint8Array(fs.readFileSync('tests/fixtures/scanned.pptx'))),read);expect(result.pages).toBe(2);expect(result.text).toContain('राजधानी');expect(result.text).toContain('Constitution');
},30000);
it('renders scanned PDF pages to pixels, performs real OCR and creates both MCQ and theory content',async()=>{
 const result=await pdfOcr(new Uint8Array(fs.readFileSync('tests/fixtures/scanned.pdf')),{mode:'auto',language:'hin+eng'},new AbortController().signal,()=>{},async canvas=>{const r=await worker.recognize((canvas as any).toBuffer('image/png'));return{text:r.data.text,confidence:r.data.confidence};},assets,()=>createCanvas(1,1) as unknown as HTMLCanvasElement);
 expect(result.pages).toBe(2);expect(result.text).toContain('भारत');expect(result.text).toContain('सर्वोच्च कानून');const questions=extractMCQs(result.text);expect(questions.questions).toHaveLength(1);expect(questions.questions[0].correctOption).toBe(1);const theory=createTheorySlides({...newProject(),source:result.text},'theory-bullets');expect(theory.slides.map(s=>s.text).join(' ')).toContain('Constitution');fs.writeFileSync('test-output/ocr-extracted.txt',result.text);
},30000);
it('extracts bitmap records from real legacy PPT for OCR',async()=>{const images=await legacyPictures(new Uint8Array(fs.readFileSync('tests/fixtures/scanned.ppt')));expect(images).toHaveLength(2);const text=await read(images[0].bytes);expect(extractMCQs(text).questions[0].correctOption).toBe(1);},30000);
it('keeps selectable text in auto mode, forces OCR only when requested, and stops cancelled PDFs',async()=>{
 expect(needsOcr('Header','auto')).toBe(true);expect(needsOcr('A long selectable paragraph. '.repeat(4),'auto')).toBe(false);expect(needsOcr('A long selectable paragraph. '.repeat(4),'full')).toBe(true);expect(needsOcr('','off')).toBe(false);
 const recognize=vi.fn();await pdfOcr(new Uint8Array(fs.readFileSync('tests/fixtures/lesson.pdf')),{mode:'auto',language:'hin+eng'},new AbortController().signal,()=>{},recognize,assets);expect(recognize).not.toHaveBeenCalled();
 const controller=new AbortController();controller.abort();await expect(pdfOcr(new Uint8Array(fs.readFileSync('tests/fixtures/scanned.pdf')),{mode:'full',language:'hin+eng'},controller.signal,()=>{},recognize,assets)).rejects.toMatchObject({name:'AbortError'});
},30000);
