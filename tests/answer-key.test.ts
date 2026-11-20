import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {extractMCQs} from '../src/mcq';
import {createMCQDeck} from '../src/mcqSlides';
import {newProject,type TemplateSet} from '../src/model';
import {pptxText} from '../src/contentFiles';
import {resolveSlide} from '../src/layout';
import {answerOverlay} from '../src/answers';

const questions='Q12. First question?\nA) First\nB) Second\nC) Third\nD) Fourth\n\nQ18. Second question?\nA) Red\nB) Blue\nC) Green\nD) Yellow';
const formats=[
 'Answer Key\n18-B, 12-A',
 'Answers: 18-B; 12-A',
 'उत्तरमाला\n१८. B\n१२. A',
 '18 B\n12 A',
 'Q.18: B\nQ.12: A',
 'Q No. 18 - B\nQuestion 12 = A',
 'Answer Key\n18\nB\n12\nA',
 'Answer Key\nQuestion No.\tAnswer\n18\tB\n12\tA',
 'Answer Key\nQuestion No.\t12\t18\nAnswer\tA\tB',
 '**Answer Key**\n| Q No. | Answer |\n| --- | --- |\n| 18 | B |\n| 12 | A |',
 'Answer Key: 12. (A) 18. (B)',
 '12-A / 18-B',
 '12 का A, 18 का B',
 '12A 18B',
];
it.each(formats)('matches a trailing key by question number: %s',key=>{
 const result=extractMCQs(questions+'\n\n'+key);
 expect(result.questions).toHaveLength(2);expect(result.questions.map(q=>q.correctOption)).toEqual([0,1]);expect(result.matchedAnswers).toBe(2);expect(result.needsReview).toBe(0);
 expect(result.questions[0].options[3].text).toBe('Fourth');expect(result.questions[1].options[3].text).toBe('Yellow');expect(result.questions[1].text).not.toContain('Answer Key');
});

it('matches Hindi and zero-padded numbers and question-number labels without using their output positions',()=>{
 const r=extractMCQs('Q No. 0012. First?\nA) One\nB) Two\nप्रश्न १८. दूसरा?\n(क) लाल\n(ख) नीला\nउत्तर कुंजी\n१८: ख\n१२: A');
 expect(r.questions.map(q=>q.correctOption)).toEqual([0,1]);
});
it('keeps conflicting, invalid, multi-answer and duplicated-question keys unmarked for manual review',()=>{
 for(const key of ['12-A, 12-B, 18-B','12-A/C, 18-B','12-X, 18-B']){const r=extractMCQs(questions+'\nAnswer Key\n'+key);expect(r.questions.map(q=>q.correctOption)).toEqual([undefined,1]);expect(r.needsReview).toBe(1);}
 const inline=extractMCQs(questions.replace('Q18.','Answer: B\nQ18.')+'\nAnswer Key\n12-A,18-B');expect(inline.questions[0].correctOption).toBeUndefined();expect(inline.needsReview).toBe(1);
 const duplicate=extractMCQs(questions.replace('Q18.','Q12.')+'\nAnswer Key\n12-A');expect(duplicate.questions.every(q=>q.correctOption===undefined&&!!q.answerWarning)).toBe(true);
});
it('does not guess unnumbered questions or accept unrelated unlabelled numeric suffixes',()=>{
 const r=extractMCQs(questions+'\n\n91-A,92-B');expect(r.matchedAnswers).toBe(0);expect(r.questions).toHaveLength(2);
 const unnamed=extractMCQs(questions.replace(/Q(?:12|18)\. /g,'')+'\nAnswer Key\n1-A,2-B');expect(unnamed.matchedAnswers).toBe(0);
 const single=extractMCQs('Q12. First?\nA) One\nB) Two\nAnswer Key: 12-B');expect(single.questions[0].correctOption).toBe(1);
});
it('does not mistake the last question’s numbered letter options for an unlabelled answer key',()=>{
 const source='Q1. First?\nA) One\nB) Two\nQ2. Second?\nA) Red\nB) Blue\nQ3. Choose a letter?\n(1) A\n(2) B';
 const r=extractMCQs(source);expect(r.questions).toHaveLength(3);expect(r.matchedAnswers).toBe(0);expect(r.questions[2].options.map(o=>o.text)).toEqual(['A','B']);
});
it('processes a large reversed answer key and keeps source text and click-reveal settings intact',()=>{
 const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet,p=newProject();
 p.source=Array.from({length:50},(_,i)=>`Q${i+11}. Question?\nA) First\nB) Second\nC) Third\nD) Fourth`).join('\n\n')+'\n\n'+Array.from({length:50},(_,i)=>`${60-i}-${'ABCD'[(60-i)%4]}`).join(', ');
 const {project,analysis}=createMCQDeck(p,templates);expect(project.source).toBe(p.source);expect(analysis.matchedAnswers).toBe(50);
 for(const [i,s] of project.slides.entries()){expect(s.correctOption).toBe((i+11)%4);expect(s.answerReveal).toBe(true);expect(s.answerOrigin).toBe('source');expect(answerOverlay(s,resolveSlide(project,s,templates,i))?.text).toContain(['First','Second','Third','Fourth'][(i+11)%4]);}
});
it('extracts a key from a later PPT slide and from the OCR text of an image slide',async()=>{
 const deck=new PptxGenJS();deck.layout='LAYOUT_WIDE';deck.addSlide().addText(questions,{x:.5,y:.5,w:10,h:6,fontSize:16});deck.addSlide().addText('Answer Key\nQuestion No.\tAnswer\n18\tB\n12\tA',{x:.5,y:.5,w:10,h:6,fontSize:16});
 const extracted=await pptxText(await JSZip.loadAsync(await deck.write({outputType:'arraybuffer'}) as ArrayBuffer));expect(extractMCQs(extracted.text).questions.map(q=>q.correctOption)).toEqual([0,1]);
 const imageDeck=new PptxGenJS();imageDeck.addSlide().addText(questions,{x:.5,y:.5,w:9,h:5,fontSize:14});imageDeck.addSlide().addImage({data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=',x:0,y:0,w:10,h:5});
 const ocr=await pptxText(await JSZip.loadAsync(await imageDeck.write({outputType:'arraybuffer'}) as ArrayBuffer),async()=> 'उत्तरमाला\n१८\nB\n१२\nA');expect(extractMCQs(ocr.text).questions.map(q=>q.correctOption)).toEqual([0,1]);
});
