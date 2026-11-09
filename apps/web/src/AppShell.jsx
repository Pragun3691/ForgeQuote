import React,{useEffect,useRef} from 'react';
import {Brand,NavIcon} from './Brand.jsx';
import {ActionButton,Notice} from './ui.jsx';

export default function AppShell({route,destinations={rfqs:"#",approvals:"#approvals"},user,busy,error,logout,children}) {
  const shell=useRef(null),sidebar=useRef(null),content=useRef(null);
  const previousTask=useRef(null);
  const task=`${route.view}:${route.rfqId||''}`;
  useEffect(()=>{
    const titles={register:'RFQs',intake:'New RFQ',approvals:'Approvals',rates:'Rate catalogue',rfq:'RFQ'};
    document.title=`${titles[route.view]||'Workspace'} · ForgeQuote`;
    // Metadata, saved-version changes and background reads never enter this effect.
    if(previousTask.current!==null && previousTask.current!==task){
      const heading=route.view==='approvals'?content.current.querySelector('#approvals h2'):
        route.view==='intake'?content.current.querySelector('.rfq-intake h2'):
        [...content.current.querySelectorAll('main h1')].find(el=>el.getClientRects().length);
      const target=heading||content.current;
      target.tabIndex=-1;target.focus();
    }
    previousTask.current=task;
  },[task,route.view]);
  useEffect(()=>{
    const sidebarElement=sidebar.current,shellElement=shell.current;
    const measure=()=>{
      // Resize delivery can race auth unmount before passive effect cleanup.
      if(!sidebarElement.isConnected || !shellElement.isConnected)return;
      const height=getComputedStyle(sidebarElement).position==='sticky'?sidebarElement.getBoundingClientRect().height:0;
      shellElement.style.setProperty('--shell-offset',`${height}px`);
    };
    const observer=new ResizeObserver(measure);observer.observe(sidebarElement);
    window.addEventListener('resize',measure);measure();
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
  },[]);
  return <div ref={shell} className="authenticated-shell">
    <a className="skip-link" href="#main-content" onClick={event=>{event.preventDefault();content.current.focus();}}>Skip to main content</a>
    <aside ref={sidebar} className="sidebar">
      <Brand/><p className="nav-caption">Workspace</p>
      <nav className="app-nav" aria-label="Workspace navigation">
        <a href={destinations.rfqs} aria-current={route.section==='rfqs'?'page':undefined}><NavIcon type="rfq"/>RFQs</a>
        {user.role==='sales_head' && <a href={destinations.approvals} aria-current={route.section==='approvals'?'page':undefined} onClick={()=>{if(route.view==='approvals')document.getElementById('approvals')?.scrollIntoView();}}><NavIcon type="approval"/>Approvals</a>}
        <a href="#view=rates" aria-current={route.section==='rates'?'page':undefined} target={route.view==='intake' && user.role==='estimator'?'_blank':undefined} rel="noreferrer"><NavIcon type="rates"/>Rate catalogue</a>
      </nav>
      <div className="sidebar-footer"><p className="demo-note">Synthetic data<span>Nonconfidential data only</span></p>
        <div className="identity"><h2><span className="sr-only">Signed in as </span>{user.username}</h2><span className="role-label">{user.role==='sales_head'?'Sales Head':'Estimator'}</span>
          <ActionButton variant="secondary" onClick={logout} disabled={busy}>{busy?'Signing out...':'Sign out'}</ActionButton>
        </div>
      </div>
    </aside>
    <div ref={content} id="main-content" tabIndex={-1} className="app-content">
      {error && <Notice tone="error" role="alert">{error}</Notice>}{children}
    </div>
  </div>;
}
