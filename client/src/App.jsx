// Coordinates the signed-in dashboard, lesson editor and freshly loaded attachments.
import CoachingChat from './CoachingChat.jsx';
import React, { useEffect, useState } from 'react';
import LessonForm from './LessonForm.jsx';
import LessonCard from './LessonCard.jsx';
import AiLessonForm from './AiLessonForm.jsx';
import { disciplineNavigation, filterLessons } from './lesson-view.js';
import { fetchMedia, withApprovedVideos } from './media.js';

// Keeps lessons and media together while one editor is open.
export default function App({ user, onLogOut }) {
  const [lessons, setLessons] = useState([]);
  const [audience, setAudience] = useState('All');
  const [discipline, setDiscipline] = useState('All');
  const visibleLessons = filterLessons(lessons, audience, discipline);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [opening, setOpening] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(null);
  const [editingMedia, setEditingMedia] = useState([]);
  const [media, setMedia] = useState([]);
  const [mediaError, setMediaError] = useState('');
  const [mediaReload, setMediaReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // Loads saved lessons with an abort signal so stale requests cannot overwrite a newer screen.
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

  useEffect(() => {
    const controller = new AbortController();
    // Loads attachments separately so a media error does not hide the lesson text.
    async function loadMedia() {
      try {
        const data = await fetchMedia(controller.signal);
        setMedia(data);
        setMediaError('');
      } catch (failure) {
        if (failure.name !== 'AbortError') setMediaError('Could not load saved pictures and videos. Your lessons are still shown.');
      }
    }
    loadMedia();
    return () => controller.abort();
  }, [reload, mediaReload]);

  // Selects attachments for one lesson instead of showing another lesson's media.
  const mediaFor = id => media.filter(item => item.lesson_id === id);

  // Fetches current attachments before opening the editor, preventing stale media from being silently removed.
  async function handleEdit(lesson, approvedVideos = []) {
    setNotice(null);
    setOpening(true);
    try {
      const fresh = await fetchMedia();
      const attached = fresh.filter(item => item.lesson_id === lesson.id);
      // Merge against freshly fetched attachments so batch approval does not remove newly saved media.
      setEditingMedia(withApprovedVideos(attached, approvedVideos));
      setMedia(fresh);
      setMediaError('');
      setEditing(lesson);
      setFormOpen('manual');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    } catch {
      setNotice({ tone: 'warning', text: 'Could not load this lesson’s pictures and videos, so editing was not opened (saving without them could remove them). Check the connection and try again.' });
      return false;
    } finally { setOpening(false); }
  }

  // Refreshes the dashboard and checks attachments after the server confirms a save.
  async function handleSaved(lesson, sent) {
    setLessons(current => current.some(item => item.id === lesson.id) ? current.map(item => item.id === lesson.id ? lesson : item) : [lesson, ...current]);
    setAudience('All');
    setDiscipline('All');
    setFormOpen(false);
    setEditing(null);
    setNotice({ tone: 'success', text: `Saved “${lesson.title}”.${sent ? ' Checking its pictures and videos…' : ''}` });
    let text = `Saved “${lesson.title}”.`;
    let tone = 'success';
    try {
      const fresh = await fetchMedia();
      setMedia(fresh);
      setMediaError('');
      const stored = fresh.filter(item => item.lesson_id === lesson.id).length;
      if (sent === undefined) text += stored ? ` It has ${stored} picture${stored === 1 ? '' : 's'} or video${stored === 1 ? '' : 's'}.` : '';
      else if (stored === sent) text += sent ? ` ${stored} picture${stored === 1 ? '' : 's'} or video${stored === 1 ? '' : 's'} saved with it.` : ' It has no pictures or videos.';
      else { tone = 'warning'; text += ` Only ${stored} of ${sent} pictures and videos were stored. Open the lesson to check them.`; }
    } catch {
      tone = 'warning';
      text += ' The lesson was saved, but its pictures and videos could not be re-checked just now. Press Retry loading media.';
      setMediaError('Could not load saved pictures and videos. Your lessons are still shown.');
    }
    setNotice({ tone, text });
    requestAnimationFrame(() => document.getElementById(`lesson-${lesson.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }

  return (
    <main>
      <header className="hero">
        <div><p className="eyebrow">PLAN WITH PURPOSE</p><h1>CoachLab</h1><p>Your next great session starts with a clear plan.</p><p className="account-line">Signed in as <strong>{user.name}</strong> ({user.email}) · <button type="button" className="link" onClick={onLogOut}>Log out</button></p></div>
        <div className="actions"><button disabled={loading || !!formOpen} onClick={() => { setNotice(null); setFormOpen('manual'); }}>+ New Lesson</button><button className="secondary" disabled={loading || !!formOpen} onClick={() => { setNotice(null); setFormOpen('ai'); }}>AI lesson draft</button></div>
      </header>
      <nav className="discipline-nav" aria-label="Filter lessons by discipline">{['All', ...disciplineNavigation].map(value => <button type="button" key={value} aria-pressed={discipline === value} onClick={() => setDiscipline(value)}>{value === 'Brazilian Jiu-Jitsu' ? 'BJJ' : value === 'All' ? 'All disciplines' : value}</button>)}</nav>
      {notice && <div className={`notice-bar ${notice.tone}`} role="status"><span>{notice.text}</span><button type="button" className="secondary" onClick={() => setNotice(null)}>Dismiss</button></div>}
      {formOpen === 'manual' && <LessonForm key={editing?.id || 'new'} lesson={editing} media={editing ? editingMedia : []} onSaved={handleSaved} onCancel={() => { setFormOpen(false); setEditing(null); }} />}
      {formOpen === 'ai' && <AiLessonForm onSaved={handleSaved} onCancel={() => setFormOpen(false)} />}
      <section aria-labelledby="lessons-heading">
        <div className="section-heading"><h2 id="lessons-heading">Your lesson plans</h2><span>{visibleLessons.length} shown · {lessons.length} saved</span></div>
        <label>Filter by audience<select value={audience} onChange={event => setAudience(event.target.value)}>{['All', 'Kids', 'Adults', 'Unspecified'].map(value => <option key={value}>{value}</option>)}</select></label>
        {!loading && !error && lessons.length > 0 && visibleLessons.length === 0 && <p role="status">No lessons match these filters. Choose All to see more.</p>}
        {loading && <p role="status">Loading lesson plans…</p>}
        {mediaError && <div className="error" role="alert"><p>{mediaError}</p><button className="secondary" onClick={() => setMediaReload(value => value + 1)}>Retry loading media</button></div>}
        {error && <div className="error" role="alert"><p>{error}</p><button className="secondary" disabled={loading || !!formOpen} onClick={() => setReload(value => value + 1)}>Retry loading</button></div>}
        {!loading && !error && lessons.length === 0 && <div className="empty"><h3>A fresh start for your next session</h3><p>Select New Lesson to create your first plan. Saved lessons will appear here.</p></div>}
        <div className="lesson-grid">{visibleLessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} media={mediaFor(lesson.id)} disabled={!!formOpen || opening} onApproveVideo={item => handleEdit(lesson, item)} onEdit={() => handleEdit(lesson)} onDeleted={() => { setLessons(current => current.filter(item => item.id !== lesson.id)); setMedia(current => current.filter(item => item.lesson_id !== lesson.id)); setNotice({ tone: 'success', text: 'Lesson deleted.' }); }} />)}</div>
      </section>
      <CoachingChat key={user.id} />
    </main>
  );
}
