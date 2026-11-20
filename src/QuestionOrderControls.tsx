import {SettingsSection} from './SettingsSection';
import {SelectionButtons} from './SelectionButtons';
import type {QuestionLanguageOrder} from './questionOrder';
export function QuestionOrderControls({value,disabled=false,onChange}:{value?:QuestionLanguageOrder;disabled?:boolean;onChange:(value:QuestionLanguageOrder)=>void}){
 return <SettingsSection title="Language order"><SelectionButtons ariaLabel="Language order" tone="orange" value={value} disabled={disabled} options={[{value:'hi-first',label:'Hindi first'},{value:'en-first',label:'English first'}]} onChange={onChange}/></SettingsSection>;
}
