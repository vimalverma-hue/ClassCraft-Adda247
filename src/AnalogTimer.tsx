import {useEffect,useRef,useState} from 'react';
import {timerDigits,timerProgress,timerNumberSize,timerFaceColor,timerRed,timerTextColor,type SlideTimer} from './timers';
export function AnalogTimer({timer,interactive=false,started,paused=false}:{timer:SlideTimer;interactive?:boolean;started?:boolean;paused?:boolean}){
 const[elapsed,setElapsed]=useState(0),[running,setRunning]=useState(false),anchor=useRef(0),saved=useRef(0);
 useEffect(()=>{setElapsed(0);saved.current=0;setRunning(started===true);},[timer.seconds,started]);
 useEffect(()=>{if(!running)return;anchor.current=Date.now();const interval=setInterval(()=>{const ms=Math.min(timer.seconds*1000,saved.current+Date.now()-anchor.current);setElapsed(ms);if(ms>=timer.seconds*1000){saved.current=ms;setRunning(false);}},50);return()=>clearInterval(interval);},[running,timer.seconds]);
 useEffect(()=>{if(!paused||!running)return;const ms=Math.min(timer.seconds*1000,saved.current+Date.now()-anchor.current);saved.current=ms;setElapsed(ms);setRunning(false);},[paused,running,timer.seconds]);
 const standalone=interactive&&started===undefined;
 const toggle=()=>{if(!standalone||paused)return;if(running){saved.current=Math.min(timer.seconds*1000,saved.current+Date.now()-anchor.current);setElapsed(saved.current);setRunning(false);}else{if(elapsed>=timer.seconds*1000){saved.current=0;setElapsed(0);}setRunning(true);}};
 const remaining=timer.seconds-Math.min(timer.seconds,Math.floor(elapsed/1000)),progress=timerProgress(elapsed/1000,timer.seconds),angle=progress*Math.PI*2;
 return <div style={{position:'absolute',zIndex:2,left:timer.x,top:timer.y,width:timer.size,height:timer.size}} onClick={e=>{if(standalone)e.stopPropagation();}} onKeyDown={e=>{if(standalone)e.stopPropagation();}}><svg viewBox="0 0 200 200" width="100%" height="100%" role={standalone?'button':'img'} aria-label={'Countdown timer · '+timer.seconds+' seconds'} tabIndex={standalone?0:undefined} onClick={toggle} onKeyDown={e=>{if(standalone&&['Enter',' '].includes(e.key)){e.preventDefault();toggle();}}} style={{cursor:standalone?'pointer':'default'}}>
  <circle cx="100" cy="100" r="98" fill="white" stroke="#34413c" strokeWidth=".7"/>
  <circle cx="100" cy="100" r="74" fill={timerFaceColor(timer)}/>
  <circle cx="100" cy="100" r="86" fill="none" stroke={timerRed} strokeWidth="24" strokeLinecap="round" pathLength="1" strokeDasharray={`${progress} 1`} transform="rotate(-90 100 100)" data-timer-progress={progress}/>
  {Array.from({length:40},(_,i)=><line key={i} x1="100" y1="30" x2="100" y2={i%10===0?42:i%5===0?38:35} stroke="#8d7d80" strokeWidth={i%10===0?1.2:.7} transform={'rotate('+i*9+' 100 100)'}/>)}
  <circle cx="100" cy="14" r="12" fill={timerRed}/><circle cx="100" cy="14" r="5.4" fill="#d8dfdc" stroke="#34413c" strokeWidth=".8"/>
  <circle cx={100+86*Math.sin(angle)} cy={100-86*Math.cos(angle)} r="12" fill={timerRed}/><circle cx={100+86*Math.sin(angle)} cy={100-86*Math.cos(angle)} r="5.4" fill="#d8dfdc" stroke="#34413c" strokeWidth=".8" data-timer-marker="true"/>
  <text x="100" y="104" dominantBaseline="central" textAnchor="middle" fontFamily="Impact, 'Arial Narrow', 'Rajdhani', sans-serif" fontSize={timerNumberSize(timer.seconds)} fontWeight="400" fill={timerTextColor(timer)} aria-live="off">{timerDigits(remaining,timer.seconds)}</text>
 </svg></div>;
}
