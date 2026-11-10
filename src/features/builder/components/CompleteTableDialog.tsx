import {useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {DashboardTile} from '../../../../shared/types/dashboard';
import {useModalAccessibility} from '../hooks/useModalAccessibility';
import {ResultTableBrowser} from './ResultTableBrowser';
import './complete-table-dialog.css';

export function CompleteTableDialog({tile,onClose}:{tile:DashboardTile;onClose:()=>void}){
 const modal=useRef<HTMLElement|null>(null),title=useId(),help=useId();useModalAccessibility(modal,onClose);
 const fallback=useRef<HTMLButtonElement|null>(null);
 const[portalTarget]=useState(()=>document.fullscreenElement??document.body);
 return createPortal(<div className="complete-table-backdrop" data-canvas-keyboard-scope="controls" onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}>
  <section ref={modal} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={title} aria-describedby={help} className="complete-table-dialog">
   <header><div><h2 id={title}>Complete recorded table: {tile.title||tile.name}</h2><p id={help}>Search answers and columns, then browse every recorded cell. These display filters never recalculate values, percentages, bases or statistical comparisons.</p></div><button ref={fallback} type="button" onClick={onClose}>Close complete table</button></header>
   <ResultTableBrowser tile={tile} fallback={fallback}/>
  </section>
 </div>,portalTarget);
}
