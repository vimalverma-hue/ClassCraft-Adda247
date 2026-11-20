import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/noto-sans/400.css';
import '@fontsource/noto-sans/600.css';
import '@fontsource/noto-sans/700.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/700.css';
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/700.css';
import 'katex/dist/katex.min.css';
import './styles.css';
import App from './App';
import {installButtonRipples} from './buttonRipples';
const removeButtonRipples=installButtonRipples();
import.meta.hot?.dispose(removeButtonRipples);
class Boundary extends React.Component<{children:React.ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(e:Error){return{error:e.message};}render(){return this.state.error?<div className="fatal"><h1>We couldn’t open this project.</h1><p>{this.state.error}</p><p>Your saved projects have not been deleted.</p><button onClick={()=>{localStorage.setItem('classslide-recovery','yes');location.reload();}}>Open a new project safely</button></div>:this.props.children;}}
createRoot(document.getElementById('root')!).render(<Boundary><App/></Boundary>);
