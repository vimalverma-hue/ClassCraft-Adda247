type RecordData=Record<string,unknown>;
export function questionRecord(record:RecordData,index:number){
 const question=record.question??record.question_text??record.prompt;if(typeof question!=='string')return;
 let values=record.options??record.choices;if(!values&&['A','B'].every(k=>record[k]!==undefined))values=Object.fromEntries(['A','B','C','D','E'].filter(k=>record[k]!==undefined&&record[k]!=='').map(k=>[k,record[k]]));
 const options=Array.isArray(values)?values.map((value,i)=>[String.fromCharCode(65+i),value]):values&&typeof values==='object'?Object.entries(values):[];
 if(options.length<2)return;
 const lines=[(/^(?:Q\.?\s*\d|\d+[).])/.test(question)?'':`Q.${index+1} `)+question,...options.map(([label,value])=>String(label).replace(/[).:]$/,'')+') '+(typeof value==='object'&&value!==null?String((value as RecordData).text??(value as RecordData).value??JSON.stringify(value)):String(value)))];
 const answer=record.answer??record.correct_answer??record.correctAnswer;if(answer!==undefined&&answer!=='')lines.push('Answer: '+String(answer));const explanation=record.explanation??record.description;if(explanation)lines.push('Explanation: '+String(explanation));return lines.join('\n');
}
export function jsonContent(text:string){const value=JSON.parse(text);const records=Array.isArray(value)?value:typeof value==='object'&&value?(value.questions??value.items??[value]):[];if(Array.isArray(records)&&records.length){const questions=records.map((r,i)=>r&&typeof r==='object'?questionRecord(r,i):undefined);if(questions.every(Boolean))return questions.join('\n\n');const notes=records.map(r=>typeof r==='string'?r:r&&typeof r==='object'&&typeof(r.text??r.content)==='string'?(r.title?'# '+r.title+'\n\n':'')+(r.text??r.content):undefined);if(notes.every(v=>typeof v==='string'))return notes.join('\n\n');}return typeof value==='string'?value:JSON.stringify(value,null,2);}
export function csvContent(text:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('CSV has an unclosed quote. Correct the file and import it again.');row.push(cell);if(row.some(Boolean))rows.push(row);if(!rows.length)return'';
 const headers=rows[0].map(h=>h.trim()),records=rows.slice(1).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]||'']))),questions=records.map(questionRecord);
 return questions.length&&questions.every(Boolean)?questions.join('\n\n'):rows.map(r=>r.join('\t')).join('\n');
}
