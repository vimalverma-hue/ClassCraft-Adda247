import type {Theme} from './model';
import {contrastRatio} from './colourContrast';

/** Header-strip colours from the supplied Teaching 01–03 and Home Work artwork. */
export function headerTextColour(theme:Theme,templateIndex=theme.templateIndex){
 const strips=theme.variant==='dark'?['#ffffff','#d9202e','#333333','#ffffff']:['#d9202e','#191a1c','#d9202e','#181818'];
 const candidate=theme.mode==='original'?strips[templateIndex-2]||theme.headerColor:theme.headerColor==='transparent'?theme.background:theme.headerColor;
 const background=/^#[0-9a-f]{6}$/i.test(candidate)?candidate:'#333333';
 const automatic=contrastRatio('#ffffff',background)>contrastRatio('#292a32',background)?'#ffffff':'#292a32';
 return theme.headerTextColor&&/^#[0-9a-f]{6}$/i.test(theme.headerTextColor)&&contrastRatio(theme.headerTextColor,background)>=4.5?theme.headerTextColor:automatic;
}
