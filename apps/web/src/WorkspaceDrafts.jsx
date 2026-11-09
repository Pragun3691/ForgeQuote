import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {createDraftStore} from './draft-store.js';

const Context=createContext(null);
export function WorkspaceDrafts({children}) {
  const ref=useRef(null);if(!ref.current)ref.current=createDraftStore();
  useEffect(()=>{const warn=event=>{if(ref.current.hasUnsaved()){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
  return <Context.Provider value={ref.current}>{children}</Context.Provider>;
}
export function useMemoryDraft(key,initial) {
  const store=useContext(Context);
  const [value,setValue]=useState(()=>store.read(key,initial));
  const update=useCallback(next=>{const value=typeof next==='function'?next(store.read(key)):next;store.write(key,value);setValue(value);},[store,key]);
  return [value,update];
}
export function useDraftMarker(key) {
  const store=useContext(Context);
  return useCallback(value=>store.mark(key,value),[store,key]);
}
