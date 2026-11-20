const numberOnly=/^(?:(?:Q(?:uestion)?\.?|प्रश्न(?:\s*संख्या)?)[ \t]*(?:(?:No\.?|Number)[ \t]*)?[:.：\-]?[ \t]*)?(?:\([0-9०-९]+\)|[0-9०-९]+)[ \t]*[).:：\-]?$/i;
export const isQuestionNumberLine=(text:string)=>numberOnly.test(text.trim());

/** Join only the leading question-number line; keep the question's other paragraphs. */
export function joinQuestionNumber(text:string):string{
 const lines=text.split(/\r\n?|\n/);const first=lines.findIndex(line=>line.trim());
 if(first<0||!numberOnly.test(lines[first].trim()))return text;
 let next=first+1;while(next<lines.length&&!lines[next].trim())next++;
 if(next===lines.length||numberOnly.test(lines[next].trim())||/^\s*(?:\(?[A-Ha-hअआइईकखगघ][).:]|\([1-8]\))\s/.test(lines[next]))return text;
 return [...lines.slice(0,first),lines[first].trimEnd()+' '+lines[next].trimStart(),...lines.slice(next+1)].join('\n');
}
