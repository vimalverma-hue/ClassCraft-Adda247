import {it,expect} from 'vitest';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import {highlightedRuns} from '../src/textHighlight';
import {nativeText} from '../src/nativeText';
import type {Element} from '../src/model';

const element:Element={id:'question',kind:'text',x:0,y:0,w:1000,h:200,font:'Noto Sans Devanagari',highlightColor:'#ffcc4d'};
it('highlights bilingual selections across line wraps and coloured label runs without losing text',()=>{
 const e={...element,runs:[{text:'Q.1',color:'#00ffff',bold:true},{text:' भारत की\nराजधानी / Capital of India?'}],highlight:'Q.1 भारत की राजधानी'};
 const runs=highlightedRuns(e);expect(runs.map(r=>r.text).join('')).toBe('Q.1 भारत की\nराजधानी / Capital of India?');expect(runs.filter(r=>r.highlight).map(r=>r.text).join('')).toBe('Q.1 भारत की\nराजधानी');expect(runs[0].bold).toBe(true);
 const native=nativeText(e);expect(native.filter(r=>r.options?.highlight).map(r=>r.text).join('')).toBe('Q.1 भारत की\nराजधानी');expect(native.filter(r=>r.options?.highlight).every(r=>r.options?.color==='171925')).toBe(true);
});
it('treats keyword punctuation literally and preserves unselected run colours',()=>{
 const runs=highlightedRuns({...element,runs:[{text:'A)',color:'#00ffff'},{text:' C++ (a+b) and C++ (a+b)'}],highlight:'C++ (a+b)'});
 expect(runs.filter(r=>r.highlight).map(r=>r.text)).toEqual(['C++ (a+b)','C++ (a+b)']);expect(runs[0].color).toBe('#00ffff');expect(runs[0].highlight).toBeUndefined();
});
it('writes the same readable highlight to editable PowerPoint text',async()=>{
 const ppt=new PptxGenJS(),slide=ppt.addSlide();slide.addText(nativeText({...element,text:'भारत / India',highlight:'भारत / India'}),{x:1,y:1,w:5,h:1,fontSize:28});
 const zip=await JSZip.loadAsync(await ppt.write({outputType:'arraybuffer'}) as ArrayBuffer),xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
 expect(xml).toContain('<a:highlight>');expect(xml).toContain('val="FFCC4D"');expect(xml).toContain('val="171925"');expect(xml).toContain('भारत');expect(xml).toContain('India');
});
