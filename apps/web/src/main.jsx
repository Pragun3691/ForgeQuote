import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { api } from './api.js';
import Workspace from './Workspace.jsx';
import {useRoute,useListDestinations} from './route.js';
import LoginView from './LoginView.jsx';
import AppShell from './AppShell.jsx';

function App() {
  const [session, setSession] = useState(null);
  const route=useRoute(session?.user?.role);
  const destinations=useListDestinations(session?.user,route);
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

  return session?.user ? <AppShell destinations={destinations} route={route} user={session.user} busy={busy} error={error} logout={logout}>
    <Workspace destinations={destinations} key={`${session.user.id}:${session.user.role}`} session={session} onExpired={expired}/>
  </AppShell> : <LoginView {...{loading,busy,error,session,username,setUsername,password,setPassword,login}}/>;
}

createRoot(document.getElementById('root')).render(<App />);
