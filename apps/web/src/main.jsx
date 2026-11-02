import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  const [status, setStatus] = useState('Checking API and database...');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health/ready', { signal: controller.signal })
      .then(response => { if (!response.ok) throw Error('Unavailable'); return response.json(); })
      .then(() => setStatus('API and PostgreSQL are reachable.'))
      .catch(error => { if (error.name !== 'AbortError') setStatus('API or database unavailable. Check configuration and refresh.'); });
    return () => controller.abort();
  }, []);
  return <main><p>ForgeQuote / T01 checkpoint</p><h1>RFQ to quotation</h1><p role="status">{status}</p><p>Workspace and database foundation. Login and costing are not available at this checkpoint.</p></main>;
}
createRoot(document.getElementById('root')).render(<App />);
