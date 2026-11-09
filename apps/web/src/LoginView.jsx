import React,{useEffect,useRef} from 'react';
import {Brand,ManufacturingDrawing} from './Brand.jsx';
import {ActionButton,Field,Notice} from './ui.jsx';

export default function LoginView({loading,busy,error,session,username,setUsername,password,setPassword,login}){
  const main=useRef(null);
  useEffect(()=>{document.title='Sign in | ForgeQuote';},[]);
  return <><a className="skip-link" href="#login-main" onClick={event=>{event.preventDefault();main.current.focus();}}>Skip to main content</a><main ref={main} id="login-main" tabIndex={-1} className="login-layout">
    <section className="login-story" aria-label="About ForgeQuote"><Brand/>
      <div className="login-story-copy"><p className="eyebrow">Built around the details</p><h1>Precision in<br/>every quotation<span className="brand-period">.</span></h1><p>From the first enquiry to the final quote. <br/>A considered workspace for manufacturing.</p></div>
      <ManufacturingDrawing/>
      <div className="login-story-footer"><span>RFQ / COSTING / REVIEW</span><span>ForgeQuote</span></div>
    </section>
    <section className="login-panel" aria-label="Sign in to ForgeQuote">
    <div className="login-meta"><span>Manufacturing workspace</span></div>
    <div className="login-form-stage"><p className="eyebrow">Your workspace awaits</p><h2 className="login-title">Sign in</h2><p className="login-intro">Choose your role to continue.</p>
    {loading && <Notice role="status">Loading your session...</Notice>}
    {error && <Notice tone="error" role="alert" id="login-error">{error}</Notice>}
    {!loading && session && !session.user && <form onSubmit={login}>
      <Field id="username" label="Account">
      <select id="username" name="username" value={username} onChange={event => setUsername(event.target.value)} disabled={busy} autoComplete="username">
        <option value="estimator">Estimator</option><option value="sales_head">Sales head</option>
      </select></Field>
      <Field id="password" label="Password" hint="Use the password supplied for the selected account." hintId="login-password-help">
      <input id="password" name="password" type="password" autoComplete="current-password" aria-describedby={error ? 'login-error login-password-help' : 'login-password-help'} value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} /></Field>
      <ActionButton type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</ActionButton>
    </form>}
    {!loading && !session && <button onClick={() => window.location.reload()}>Reload session</button>}
    <p className="login-disclosure">This demonstration uses shared Estimator and Sales Head accounts. Both can access all synthetic records. Use synthetic, nonconfidential data only.</p></div>
    <footer className="login-footer">Designed for the work behind the quote.</footer>
  </section></main></>;
}
