import React, { useEffect, useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('Checking backend connection…');

  useEffect(() => {
    const controller = new AbortController();
    async function checkBackend() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal });
        if (!response.ok) throw new Error('Backend health check failed');
        const data = await response.json();
        if (data.status !== 'ok') throw new Error('Unexpected backend response');
        setStatus('Backend connected.');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setStatus('Cannot reach the backend. Start the Express server, then refresh.');
        }
      }
    }
    checkBackend();
    return () => controller.abort();
  }, []);

  return (
    <main>
      <p className="eyebrow">YOUR COACHING WORKSPACE</p>
      <h1>CoachLab</h1>
      <p>A place to build and organize your lesson plans.</p>
      <section aria-labelledby="setup-heading">
        <h2 id="setup-heading">Getting started</h2>
        <p role="status">{status}</p>
        <p>Lesson planning will be added in a later project phase.</p>
      </section>
    </main>
  );
}
