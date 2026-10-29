import React, { useEffect, useRef, useState } from 'react';

export default function CoachingChat() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(null);
  const toggle = useRef(null);
  const input = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  function close() { setOpen(false); toggle.current?.focus(); }
  async function submit(event) {
    event.preventDefault();
    if (request.current || !message.trim()) return;
    const question = message.trim();
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 25000);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: question }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Chat could not answer. Please try later.');
      if (typeof data.answer !== 'string' || data.answer.length > 1200) throw new Error('Chat returned an invalid answer.');
      setMessages(current => [...current.slice(-8), { question, answer: data.answer }]);
      setMessage('');
    } catch (failure) {
      setError(failure.name === 'Error' ? failure.message : 'Chat connection interrupted. Your question is still here.');
    } finally { clearTimeout(timer); request.current = null; setBusy(false); }
  }
  return <aside className="coach-chat" aria-label="Coaching assistant">
    <button ref={toggle} type="button" aria-expanded={open} aria-controls="coach-chat-panel" onClick={() => open ? close() : setOpen(true)}>Coach chat</button>
    {open && <section id="coach-chat-panel" className="chat-panel" aria-labelledby="chat-heading" onKeyDown={event => { if (event.key === 'Escape') close(); }}>
      <header><h2 id="chat-heading">Ask CoachLab</h2><button type="button" className="secondary" onClick={close}>Close chat</button></header>
      <p className="chat-note">AI can be wrong. Coach review required. No medical advice. Never enter names or personal information, especially about kids.</p>
      <p className="chat-note">Read-only help; each question is independent. Not saved by CoachLab; refresh or logout clears this chat. Generic questions go to Google, whose free tier may use them to improve its products.</p>
      <div className="chat-messages" role="log" aria-live="polite">{messages.map((item, index) => <div key={index}><p><strong>You:</strong> {item.question}</p><p><strong>CoachLab:</strong> {item.answer}</p></div>)}</div>
      <form onSubmit={submit}>
        <label>Your coaching or app question<textarea ref={input} required maxLength={600} value={message} disabled={busy} onChange={event => setMessage(event.target.value)} /></label>
        <small>{message.length}/600 · 3 questions/minute, 20/day per coach</small>
        <button type="submit" disabled={busy || !message.trim()}>{busy ? 'Thinking…' : 'Send question'}</button>
      </form>
      {busy && <p role="status">Waiting for a short answer…</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </section>}
  </aside>;
}
