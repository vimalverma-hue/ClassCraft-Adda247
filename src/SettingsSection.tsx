import {createContext,useContext,useId,useState,type Dispatch,type ReactNode,type SetStateAction} from 'react';
import {ChevronDown} from 'lucide-react';

const AccordionContext=createContext<{openId:string|null;setOpenId:Dispatch<SetStateAction<string|null>>}|null>(null);

export function SettingsAccordion({children}:{children:ReactNode}){
 const [openId,setOpenId]=useState<string|null>(null);
 return <AccordionContext.Provider value={{openId,setOpenId}}>{children}</AccordionContext.Provider>;
}

export function SettingsSection({title,children}:{title:string;children:ReactNode}){
 const group=useContext(AccordionContext),id=useId();
 const [localOpen,setLocalOpen]=useState(false);
 const expanded=group?group.openId===id:localOpen;
 return <details className="settings-section" open={expanded}>
  <summary aria-expanded={expanded} onClick={event=>{event.preventDefault();if(group)group.setOpenId(current=>current===id?null:id);else setLocalOpen(current=>!current);}}><h3><span>{title}</span><ChevronDown size={18} aria-hidden="true"/></h3></summary>
  <div className="settings-section-body">{children}</div>
 </details>;
}
