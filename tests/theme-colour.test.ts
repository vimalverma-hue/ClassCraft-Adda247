import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {newProject,setVariant,type TemplateSet} from '../src/model';
import {createMCQDeck} from '../src/mcqSlides';
import {ensureClassSlides} from '../src/classSlides';
import {makeStylePreset,applyStylePreset} from '../src/stylePresets';
import {resolveSlide} from '../src/layout';
import {answerOverlay} from '../src/answers';
import {exportDeck} from '../src/exporter';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
function savedWhiteStyle(){
 let p=newProject();p.source='Q.1 भारत की राजधानी क्या है?\nWhat is the capital of India?\nA) मुंबई / Mumbai\nB) नई दिल्ली / New Delhi\nC) जयपुर / Jaipur\nD) चेन्नई / Chennai\nAnswer: B';p.style.color='#ffffff';p.style.labelColor='#e21b2e';
 p=ensureClassSlides(createMCQDeck(p,templates).project,p);p.slides[2].style.color='#FFFFFF';p=applyStylePreset(p,makeStylePreset(p,p.slides[2],'White text'));return p;
}
function checkBody(p:ReturnType<typeof newProject>,expected:string){const r=resolveSlide(p,p.slides[2],templates,2);for(const e of r.elements.filter(e=>e.id==='question'||e.id.startsWith('option-'))){expect(e.color).toBe(expected);expect(e.runs?.find(run=>run.color)?.color).toBe(p.theme.variant==='dark'?'#ffff00':'#e21b2e');}return r;}
it('reverses explicitly saved body colours on Light and back on Dark while applying theme label defaults and preserving answers and text',()=>{
 const p=savedWhiteStyle(),before=structuredClone(p),light=setVariant(p,'light');checkBody(light,'#171925');const dark=setVariant(light,'dark');checkBody(dark,'#ffffff');
 expect(p).toEqual(before);expect(dark.slides[2].text).toBe(p.slides[2].text);expect(dark.slides[2].correctOption).toBe(1);expect(dark.source).toBe(p.source);expect(dark.slides.map(s=>s.fixedSlot)).toEqual(p.slides.map(s=>s.fixedSlot));const reveal=answerOverlay(light.slides[2],checkBody(light,'#171925'))!;expect(reveal.color).toBe('#12291c');expect(reveal.fill).toBe('#86efac');
});
it('repairs an existing Light deck on another Light click, including per-slide overrides and locked/manual text',()=>{
 const p=savedWhiteStyle();p.theme.variant='light';p.slides[2].theme={...p.theme,textColor:'#ffffff'};p.slides[2].locked=true;p.slides[2].manual=true;p.slides[2].edits.question='Q.1 Edited Hindi / English question?';
 const next=setVariant(p,'light');checkBody(next,'#171925');expect(next.slides.every(s=>s.style.color==='')).toBe(true);expect(next.slides[2].edits).toEqual(p.slides[2].edits);expect(next.slides[2].locked).toBe(true);expect(next.slides[2].style.font).toBe(p.slides[2].style.font);
});
it('updates palette overrides in a saved custom theme together and preserves the explicitly styled header',()=>{
 const p=savedWhiteStyle();p.theme.mode='custom';p.slides[2].theme={...p.theme,mode:'custom',background:'#191b1c',headerText:'Class header',headerTextColor:'#ffcc4d'};
 const next=setVariant(p,'light'),r=checkBody(next,'#171925');expect(r.background).toBe('#ffffff');expect(next.slides[2].theme?.background).toBe('#ffffff');expect(r.elements.find(e=>e.id==='heading')?.color).toBe('#ffcc4d');expect(next.style.labelColor).toBe('#e21b2e');
 const back=setVariant(next,'dark');expect(resolveSlide(back,back.slides[2],templates,2).background).toBe('#191b1c');checkBody(back,'#ffffff');
});
it('exports the repaired Light and Dark text colours into native PowerPoint with red/yellow labels and answer animation',async()=>{
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const t=structuredClone(templates);for(const variant of ['dark','light'] as const)for(const slide of t[variant].slides)for(const item of slide.items)if(item.src)item.src='data:image/jpeg;base64,'+fs.readFileSync('public'+item.src).toString('base64');
  let p=savedWhiteStyle();for(const variant of ['light','dark'] as const){p=setVariant(p,variant);const blob=await exportDeck(p,t,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:true},()=>{});const bytes=await blob.arrayBuffer(),zip=await JSZip.loadAsync(bytes),xml=await zip.file('ppt/slides/slide3.xml')!.async('string'),dom=new JSDOM(xml,{contentType:'text/xml'}),doc=dom.window.document;
   const shapes=[...doc.getElementsByTagNameNS('*','sp')],question=shapes.find(s=>s.textContent?.includes('What is the capital'))!;
   const bodyRuns=[...question.getElementsByTagNameNS('*','r')].filter(r=>r.textContent!=='Q.1');expect(bodyRuns.length).toBeGreaterThan(1);for(const run of bodyRuns)expect(run.getElementsByTagNameNS('*','srgbClr')[0].getAttribute('val')?.toLowerCase()).toBe(variant==='light'?'171925':'ffffff');
   expect([...question.getElementsByTagNameNS('*','r')].filter(r=>r.textContent==='Q.1')[0].getElementsByTagNameNS('*','srgbClr')[0].getAttribute('val')?.toLowerCase()).toBe(variant==='dark'?'ffff00':'e21b2e');expect(xml).toContain('clickEffect');
   fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync(`test-output/theme-reversal-${variant}.pptx`,Buffer.from(bytes));dom.window.close();
  }
 }finally{(globalThis as any).document=prior;}
});
