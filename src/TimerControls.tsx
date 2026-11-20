import {SettingsSection} from './SettingsSection';
import {timerConfig,timerDurations,timerLabel,timerTextColor,timerFaceColor,timerMinSize,timerMaxSize,type SlideTimer} from './timers';
export function TimerControls({timer,onChange,onTextColorChange,onFaceColorChange,onSizeChange,disabled=false}:{timer?:SlideTimer;disabled?:boolean;onChange:(timer:SlideTimer|null)=>void;onTextColorChange:(color:string|undefined)=>void;onFaceColorChange:(color:string|undefined)=>void;onSizeChange:(size:number)=>void}){
 const value=timerConfig(timer)||{seconds:30 as const,x:1640,y:160,size:200};
 return <SettingsSection title="Add Timer">
  <div className="timer-duration-grid" role="group" aria-label="Timer duration">
   {timerDurations.map(seconds=>{const [number,unit]=timerLabel(seconds).split(' ');return <button key={seconds} type="button" disabled={disabled} aria-pressed={!!timer&&value.seconds===seconds} onClick={()=>onChange(timerConfig({...value,seconds})!)}><span className="timer-duration-number">{number}</span>{' '}<span className="timer-duration-unit">{unit}</span></button>;})}
  </div>
  <label className="field"><span>Timer size · {value.size} px</span><input aria-label="Timer size" type="range" min={timerMinSize} max={timerMaxSize} step={10} value={value.size} disabled={disabled||!timer} onChange={event=>onSizeChange(+event.target.value)}/></label>
  <div className="colour-row"><label>Text colour<input aria-label="Timer text colour" type="color" value={timerTextColor(value)} disabled={disabled||!timer} onChange={event=>onTextColorChange(event.target.value)}/></label><button type="button" className="text-button" aria-label="Reset timer text colour" disabled={disabled||!timer} onClick={()=>onTextColorChange(undefined)}>Reset</button></div>
  <div className="colour-row"><label>Background colour<input aria-label="Timer background colour" type="color" value={timerFaceColor(value)} disabled={disabled||!timer} onChange={event=>onFaceColorChange(event.target.value)}/></label><button type="button" className="text-button" aria-label="Reset timer background colour" disabled={disabled||!timer} onClick={()=>onFaceColorChange(undefined)}>Reset</button></div>
  <button type="button" className="text-button" disabled={disabled} onClick={()=>onChange(null)}>Remove timer</button>
 </SettingsSection>;
}
