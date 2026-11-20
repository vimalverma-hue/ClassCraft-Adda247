import type {TextStyle,Theme} from './model';
export function QuestionColourControls({style,theme,onChange}:{style:TextStyle;theme:Theme;onChange:(patch:Partial<TextStyle>)=>void}){
 return <div className="question-colour-controls">{(['questionHindiColor','questionEnglishColor'] as const).map(key=>{
  const label=key==='questionHindiColor'?'Hindi question colour':'English question colour';
  return <div className="question-colour-field" key={key}><label><span>{key==='questionHindiColor'?'Hindi question':'English question'}</span><input aria-label={label} type="color" value={style[key]||style.color||theme.textColor} onChange={event=>onChange({[key]:event.target.value})}/></label><button type="button" className="text-button" aria-label={'Reset '+label} onClick={()=>onChange({[key]:''})}>Auto</button></div>;
 })}</div>;
}
