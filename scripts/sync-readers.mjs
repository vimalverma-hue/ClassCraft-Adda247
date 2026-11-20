import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
await fs.mkdir('public/readers',{recursive:true});
await fs.copyFile('node_modules/office-oxide-wasm/web/office_oxide_bg.wasm','public/readers/office_oxide_bg.wasm');
for(const dir of ['cmaps','standard_fonts'])await fs.cp('node_modules/pdfjs-dist/'+dir,'public/readers/pdfjs/'+dir,{recursive:true});
console.log('Bundled local document readers.');
await fs.mkdir('public/readers/ocr/lang',{recursive:true});
await fs.copyFile('node_modules/tesseract.js/dist/worker.min.js','public/readers/ocr/worker.min.js');
for(const file of await fs.readdir('node_modules/tesseract.js-core'))if(/\.wasm(?:\.js)?$/.test(file))await fs.copyFile('node_modules/tesseract.js-core/'+file,'public/readers/ocr/'+file);
for(const lang of ['eng','hin'])await fs.copyFile(`node_modules/@tesseract.js-data/${lang}/4.0.0/${lang}.traineddata.gz`,`public/readers/ocr/lang/${lang}.traineddata.gz`);
await fs.mkdir('public/readers/ai',{recursive:true});
for(const name of ['ort-wasm-simd-threaded','ort-wasm-simd-threaded.jsep']){
 await fs.copyFile(`node_modules/onnxruntime-web/dist/${name}.mjs`,`public/readers/ai/${name}.mjs`);
 await fs.writeFile(`public/readers/ai/${name}.wasm.gz`,gzipSync(await fs.readFile(`node_modules/onnxruntime-web/dist/${name}.wasm`)));
}
console.log('Bundled Hindi/English OCR and on-device AI runtime. AI model downloads only after explicit use.');
