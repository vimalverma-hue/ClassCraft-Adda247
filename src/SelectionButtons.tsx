import type {TextStyle} from './model';

export function SelectionButtons<T extends string>({label,ariaLabel,value,options,disabled=false,tone='green',onChange}:{label?:string;ariaLabel:string;value?:T;options:readonly {value:T;label:string}[];disabled?:boolean;tone?:'green'|'orange';onChange:(value:T)=>void}){
 return <div className="field choice-control">{label&&<span>{label}</span>}<div className={'setting-choice-buttons'+(tone==='orange'?' choice-orange':'')} role="group" aria-label={ariaLabel}>{options.map(option=><button key={option.value} type="button" aria-pressed={value===option.value} disabled={disabled} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div></div>;
}

const alignments=[{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}] as const;
export function AlignmentButtons({value,onChange,ariaLabel='Text alignment'}:{value:TextStyle['align'];onChange:(value:TextStyle['align'])=>void;ariaLabel?:string}){
 return <SelectionButtons label="Alignment" ariaLabel={ariaLabel} value={value} options={alignments} onChange={onChange}/>;
}
