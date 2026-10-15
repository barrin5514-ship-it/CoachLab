import React, { useEffect, useState } from 'react';
import LessonForm from './LessonForm.jsx';
import LessonCard from './LessonCard.jsx';
import AiLessonForm from './AiLessonForm.jsx';

export default function App() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadLessons() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/lessons', { signal: controller.signal });
        if (!response.ok) throw new Error('Unable to load lessons.');
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Unexpected lesson response.');
        setLessons(data);
      } catch (failure) {
        if (failure.name !== 'AbortError') setError('Could not load saved lessons. Check the backend connection and try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadLessons();
    return () => controller.abort();
  }, [reload]);

  function handleSaved(lesson) {
    setLessons(current => [lesson, ...current.filter(item => item.id !== lesson.id)]);
    setNotice(`Saved “${lesson.title}”.`);
    setFormOpen(false);
  }

  return (
    <main>
      <header className="hero">
        <div><p className="eyebrow">PLAN WITH PURPOSE</p><h1>CoachLab</h1><p>Your next great session starts with a clear plan.</p></div>
        <div className="actions"><button disabled={loading || !!formOpen} onClick={() => { setNotice(''); setFormOpen('manual'); }}>+ New Lesson</button><button className="secondary" disabled={loading || !!formOpen} onClick={() => { setNotice(''); setFormOpen('ai'); }}>AI lesson draft</button></div>
      </header>
      {notice && <p className="success" role="status">{notice}</p>}
      {formOpen === 'manual' && <LessonForm onSaved={handleSaved} onCancel={() => setFormOpen(false)} />}
      {formOpen === 'ai' && <AiLessonForm onSaved={handleSaved} onCancel={() => setFormOpen(false)} />}
      <section aria-labelledby="lessons-heading">
        <div className="section-heading"><h2 id="lessons-heading">Your lesson plans</h2><span>{lessons.length} saved</span></div>
        {loading && <p role="status">Loading lesson plans…</p>}
        {error && <div className="error" role="alert"><p>{error}</p><button className="secondary" disabled={loading || !!formOpen} onClick={() => setReload(value => value + 1)}>Retry loading</button></div>}
        {!loading && !error && lessons.length === 0 && <div className="empty"><h3>A fresh start for your next session</h3><p>Select New Lesson to create your first plan. Saved lessons will appear here.</p></div>}
        <div className="lesson-grid">{lessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)}</div>
      </section>
    </main>
  );
}
