import type {TextStyle} from './model';

export const MIN_QUESTION_GAP=8;
export const MAX_QUESTION_GAP=200;

export function questionOptionsGap(style:Pick<TextStyle,'questionGap'|'paragraphGap'>){
 const gap=style.questionGap;
 return typeof gap==='number'&&Number.isFinite(gap)
  ?Math.max(MIN_QUESTION_GAP,Math.min(MAX_QUESTION_GAP,gap))
  :Math.max(36,style.paragraphGap+20);
}
