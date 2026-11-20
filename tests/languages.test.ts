import 'fake-indexeddb/auto';
import {it,expect,vi} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {newProject,type TemplateSet} from '../src/model';
import {prepareLanguageProject,languageEntries,languagePair,translateEntries,applyLanguageEntries,missingDirections,localizedText,readLanguageEntry} from '../src/languages';
import {onlineTranslate,translationChunks,translationSession} from '../src/translation';
import {answerOverlay,answerOptions} from '../src/answers';
import {resolveSlide} from '../src/layout';
import {saveProject,restoreProject,exportProject,importProject} from '../src/storage';
import {applyLabelColour} from '../src/labelColour';
import {exportDeck} from '../src/exporter';
import {generateSlides} from '../src/parser';
import {translationWarnings} from '../src/languages';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
const input='Q.12\nभारत की राजधानी क्या है?\nA) मुंबई\nB) नई दिल्ली\nC) जयपुर\nD) चेन्नई\nAnswer: B\nExplanation: No explanation on the slide.';
const dictionary:Record<string,string>={'भारत की राजधानी क्या है?':'What is the capital of India?','मुंबई':'Mumbai','नई दिल्ली':'New Delhi','जयपुर':'Jaipur','चेन्नई':'Chennai'};
const signal=()=>new AbortController().signal;
function project(){const p=newProject();p.source=input;return prepareLanguageProject(applyLabelColour(p,'#e21b2e'),templates,'source');}
const translator=vi.fn(async(text:string)=>{if(!dictionary[text])throw Error('Unexpected translation: '+text);return dictionary[text];});
async function bilingual(){const p=project();return applyLanguageEntries(p,await translateEntries(languageEntries(p),'both',translator,signal(),()=>{}),'both',templates);}

it('recognizes supplied bilingual pairs without mistaking fractions, units or English abbreviations for translations',()=>{
 expect(languagePair('मुंबई / Mumbai')).toEqual({hi:'मुंबई',en:'Mumbai'});
 expect(languagePair('What is DNA?\nDNA क्या है?')).toEqual({hi:'DNA क्या है?',en:'What is DNA?'});
 expect(languagePair('दूरी किमी/घंटा में')).toEqual({hi:'दूरी किमी/घंटा में'});
 expect(languagePair('Which is 1/2?')).toEqual({en:'Which is 1/2?'});
 expect(languagePair('60')).toEqual({hi:'60',en:'60'});
});
it('converts all MCQ fields, keeps number inline, slash-separated options, source, order, covers and answer index',async()=>{
 const p=project(),before=structuredClone(p);const next=await bilingual(),s=next.slides[2];
 expect(s.text).toBe('Q.12 भारत की राजधानी क्या है?\nWhat is the capital of India?\nA) मुंबई / Mumbai\nB) नई दिल्ली / New Delhi\nC) जयपुर / Jaipur\nD) चेन्नई / Chennai');
 expect(s.correctOption).toBe(1);expect(s.answerReveal).toBe(true);expect(next.source).toBe(input);expect(p).toEqual(before);expect(next.slides.map(s=>s.fixedSlot)).toEqual(['welcome','thumbnail',undefined,'closing']);
 const r=resolveSlide(next,s,templates,2),overlay=answerOverlay(s,r)!;expect(r.warnings).toEqual([]);expect(overlay.text).toBe('B) नई दिल्ली / New Delhi');expect(overlay.runs?.find(r=>r.color)?.color).toBe('#ab3540');expect(s.text).not.toContain('Explanation');
});
it('switches Hindi, English and both repeatedly without retranslating or duplicating numbers/options',async()=>{
 let p=await bilingual();const noNetwork=vi.fn(async()=>{throw Error('Should reuse saved translations');});
 for(const mode of ['en','hi','both','en','both'] as const){const entries=languageEntries(p);expect(missingDirections(entries,mode)).toEqual([]);const translated=await translateEntries(entries,mode,noNetwork,signal(),()=>{});p=applyLanguageEntries(p,translated,mode,templates);expect(answerOptions(p.slides[2])).toHaveLength(4);expect(p.slides[2].correctOption).toBe(1);expect(p.slides[2].text.match(/Q\.12/g)).toHaveLength(1);if(mode==='en')expect(p.slides[2].text).not.toMatch(/[\u0900-\u097f]/);if(mode==='hi')expect(p.slides[2].text).not.toContain('Mumbai');}
 expect(noNetwork).not.toHaveBeenCalled();
});
it('uses already-pasted translations and keeps numeric options once',async()=>{
 const p=newProject();p.source='1. कितना है? / What is it?\nA) 10\nB) 20\nAnswer: A';const prepared=prepareLanguageProject(p,templates,'source');const entries=languageEntries(prepared);expect(missingDirections(entries,'both')).toEqual([]);expect(localizedText(entries[0].data,'both')).toBe('1. कितना है?\nWhat is it?\nA) 10\nB) 20');
});
it('converts English source to Hindi while preserving original option labels and supplied answer',async()=>{
 const p=newProject();p.source='2. What is the capital of India?\nA. Mumbai\nB. New Delhi\nAnswer: B';const prepared=prepareLanguageProject(p,templates,'source');const dict=Object.fromEntries(Object.entries(dictionary).map(([hi,en])=>[en,hi]));const entries=await translateEntries(languageEntries(prepared),'hi',async text=>dict[text],signal(),()=>{});const next=applyLanguageEntries(prepared,entries,'hi',templates);expect(next.slides[2].text).toBe('2. भारत की राजधानी क्या है?\nA. मुंबई\nB. नई दिल्ली');expect(next.slides[2].correctOption).toBe(1);
});
it('uses canvas edits and invalidates stale language copies without changing header/colour overrides',async()=>{
 const p=await bilingual();p.slides[2].style.labelColor='#e21b2e';p.slides[2].edits.question='Q.12 भारत की राजधानी क्या है?';p.slides[2].edits['option-0']='A) पुणे';p.slides[2].edits.heading='My class';
 const entry=readLanguageEntry(p.slides[2]);expect(entry.data.options[0]).toEqual({label:'A)',hi:'पुणे'});expect(missingDirections([entry],'both')).toEqual([['hi','en']]);
 entry.data.question.en='What is the capital of India?';entry.data.options[0].en='Pune';const next=applyLanguageEntries(p,[entry],'both',templates);expect(next.slides[2].text).toContain('A) पुणे / Pune');expect(next.slides[2].edits).toEqual({heading:'My class'});expect(next.slides[2].style.labelColor).toBe('#e21b2e');
});
it('leaves the whole project unchanged after a translation failure or cancellation',async()=>{
 const p=project(),before=structuredClone(p),entries=languageEntries(p);let calls=0;
 await expect(translateEntries(entries,'both',async()=>{if(++calls===2)throw Error('quota');return 'Translated';},signal(),()=>{})).rejects.toThrow('quota');expect(p).toEqual(before);expect(entries[0].data.question.en).toBeUndefined();
 const controller=new AbortController();controller.abort();await expect(translateEntries(entries,'both',translator,controller.signal,()=>{})).rejects.toThrow();expect(p).toEqual(before);
 p.slides[2].locked=true;expect(()=>prepareLanguageProject(p,templates,'slides')).toThrow('Unlock');
});
it('persists both language copies through browser storage and portable project ZIP',async()=>{
 const p=await bilingual();await saveProject(p);const restored=(await restoreProject())!;expect(restored.slides[2].languages).toEqual(p.slides[2].languages);expect(restored.languageMode).toBe('both');const blob=await exportProject(p),copy=await importProject({size:blob.size,arrayBuffer:()=>blob.arrayBuffer()} as File);expect(missingDirections(languageEntries(copy),'hi')).toEqual([]);expect(copy.slides[2].languages).toEqual(p.slides[2].languages);
});
it('converts a two-MCQ teaching slide into two independently marked questions',()=>{
 const p=newProject();p.source='1. Capital?\nA) Delhi\nB) Mumbai\nAnswer: A\n2. Value?\nA) 10\nB) 20\nAnswer: B';p.slides=generateSlides(p,'two-mcq');expect(p.slides.some(s=>s.layout==='two-mcq')).toBe(true);const next=prepareLanguageProject(p,templates,'slides');expect(next.slides.filter(s=>s.layout==='mcq').map(s=>s.correctOption)).toEqual([0,1]);expect(languageEntries(next)).toHaveLength(2);
});
it('flags an incomplete question translation or changed numeric values for review',()=>{
 const data=languageEntries(project())[0].data;data.question.en='Capital of India';expect(translationWarnings(data).join(' ')).toContain('incomplete');data.question.en='What is the capital of India?';data.options[0]={label:'A)',hi:'26 जनवरी 1950',en:'26 January 1947'};expect(translationWarnings(data).join(' ')).toContain('numbers differ');
});
it('respects UTF-8 byte limits and rejects a single unsplittable oversized token',()=>{
 const chunks=translationChunks(('भारतीय संविधान और स्वतंत्रता। ').repeat(30));expect(chunks.length).toBeGreaterThan(1);expect(chunks.every(c=>new TextEncoder().encode(c).length<=480)).toBe(true);expect(chunks.join(' ')).toBe(('भारतीय संविधान और स्वतंत्रता। ').repeat(30).trim());expect(()=>translationChunks('अ'.repeat(170))).toThrow('too long');
});
it('validates online responses, uses the documented language pair and handles quota/network errors',async()=>{
 const fetcher=vi.fn(async(url:URL|RequestInfo)=>{expect(new URL(String(url)).searchParams.get('langpair')).toBe('hi|en');return new Response(JSON.stringify({responseStatus:200,responseData:{translatedText:'Tom &amp; Jerry'}}));}) as unknown as typeof fetch;
 expect(await onlineTranslate('कार्टून पात्र','hi','en',signal(),fetcher)).toBe('Tom & Jerry');
 await expect(onlineTranslate('सीमा परीक्षण','hi','en',signal(),async()=>new Response(JSON.stringify({responseStatus:403,quotaFinished:true})))).rejects.toThrow('daily limit');
 await expect(onlineTranslate('रिक्त अनुवाद','hi','en',signal(),async()=>new Response(JSON.stringify({responseStatus:200,responseData:{translatedText:''}})))).rejects.toThrow('could not translate');
 await expect(onlineTranslate('कनेक्शन परीक्षण','hi','en',signal(),async()=>{throw new TypeError('fetch');})).rejects.toThrow('Cannot reach');
});
it('initializes native translator on the initiating click and cleans up without a hidden cloud fallback',async()=>{
 const prior=(globalThis as any).Translator,created=vi.fn(async()=>({translate:async()=> 'New Delhi',destroy})),destroy=vi.fn();(globalThis as any).Translator={create:created};
 try{const session=translationSession('device',[['hi','en']],signal(),()=>{});expect(created).toHaveBeenCalledTimes(1);expect(await session.translate('नई दिल्ली','hi','en')).toBe('New Delhi');session.close();expect(destroy).toHaveBeenCalledTimes(1);}finally{(globalThis as any).Translator=prior;}
});
it('exports both languages with native text, shared label colour and the same click-to-reveal correct option',async()=>{
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const t=structuredClone(templates);for(const variant of ['dark','light'] as const)for(const slide of t[variant].slides)for(const item of slide.items)if(item.src)item.src='data:image/jpeg;base64,'+fs.readFileSync('public'+item.src).toString('base64');
  const p=await bilingual();const blob=await exportDeck(p,t,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:true},()=>{});const zip=await JSZip.loadAsync(await blob.arrayBuffer()),xml=await zip.file('ppt/slides/slide3.xml')!.async('string');const dom=new JSDOM(xml,{contentType:'text/xml'}),doc=dom.window.document;const texts=[...doc.getElementsByTagNameNS('*','t')].map(n=>n.textContent).join('');expect(texts).toContain('What is the capital of India?');expect(texts).toContain('New Delhi');expect(texts).toContain('नई दिल्ली');expect(xml).toContain('clickEffect');expect(xml).toContain('E84857');expect(texts).not.toContain('Explanation');expect(zip.file(/ppt\/slides\/slide\d+\.xml$/)).toHaveLength(4);fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/bilingual-native.pptx',Buffer.from(await blob.arrayBuffer()));dom.window.close();
 }finally{(globalThis as any).document=prior;}
});
