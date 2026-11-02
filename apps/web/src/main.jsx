import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { api } from './api.js';
import Workspace from './Workspace.jsx';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('estimator');
  const [password, setPassword] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api('/auth/session', { signal: controller.signal }).then(setSession)
      .catch(error => { if (error.name !== 'AbortError') setError('Unable to load your session. Check the API and refresh.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function login(event) {
    event.preventDefault(); setBusy(true); setError('');
    const submittedPassword = password; setPassword('');
    try { setSession(await api('/auth/login', { method: 'POST', csrfToken: session.csrfToken, body: { username, password: submittedPassword } })); }
    catch (error) {
      setError(error.message || 'Unable to sign in. Please retry.');
      if (error.code === 'CSRF_INVALID') {
        try { setSession(await api('/auth/session')); } catch { setSession(null); }
      }
    } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError('');
    try {
      await api('/auth/logout', { method: 'POST', csrfToken: session.csrfToken });
      setSession(null);
      setSession(await api('/auth/session'));
    } catch (error) {
      setError(error.message || 'Unable to sign out. Please retry.');
      if (error.status === 401 || error.code === 'CSRF_INVALID') {
        try { setSession(await api('/auth/session')); } catch { setSession(null); }
      }
    } finally { setBusy(false); }
  }

  async function expired() {
    setError('Your session expired. Sign in again to continue. Your pending submission is retained in this tab.');
    setSession(null);
    try {setSession(await api('/auth/session'));} catch {setError('Your session could not be refreshed. Check the connection and reload.');}
  }

  return <><header className="topbar"><a className="brand" href="#"><span className="brand-mark">FQ</span><span>ForgeQuote<small>Manufacturing quotations</small></span></a>{session?.user && <div className="identity"><h2>Signed in as {session.user.username}</h2><button className="secondary" onClick={logout} disabled={busy}>{busy?'Signing out...':'Sign out'}</button></div>}</header>
    {session?.user && <>{error && <p role="alert" className="error auth-error">{error}</p>}<Workspace session={session} onExpired={expired}/></>}
    {!session?.user && <main className="login-panel">
    <p className="eyebrow">Synthetic demo · Secure workspace</p><h1>RFQ to quotation</h1>
    {loading && <p role="status">Loading your session...</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {!loading && session && !session.user && <form onSubmit={login}>
      <h2>Sign in</h2><p>Use one of the seeded demo identities and its configured password.</p>
      <label htmlFor="username">Demo identity</label>
      <select id="username" name="username" value={username} onChange={event => setUsername(event.target.value)} disabled={busy} autoComplete="username">
        <option value="estimator">Estimator</option><option value="sales_head">Sales head</option>
      </select>
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} />
      <button type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
    </form>}
    {!loading && !session && <button onClick={() => window.location.reload()}>Reload session</button>}
  </main>}</>;
}
createRoot(document.getElementById('root')).render(<App />);
