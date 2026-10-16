import React, { useRef, useState } from 'react';
import ActivityEditor from './ActivityEditor.jsx';
import { activityMinutes } from './activities.js';
import { PendingMedia, pendingRegistry } from './MediaEditor.jsx';
import { discardUpload, mediaPayload, newKey } from './media.js';

const disciplines = ['Boxing', 'Wrestling', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'MMA', 'Personal Training'];
const initial = { title: '', discipline: '', skill_level: 'Beginner', duration_minutes: '', goal: '', drills: '', coaching_notes: '' };
const textFields = [['goal', 'Training goal', 2000], ['coaching_notes', 'Coaching notes', 10000]];

export default function LessonForm({ onSaved, onCancel, lesson, media: savedMedia = [] }) {
  const [values, setValues] = useState(() => lesson ? Object.fromEntries(Object.keys(initial).map(key => [key, lesson[key] ?? ''])) : initial);
  const [media, setMedia] = useState(() => savedMedia.map(item => ({ ...item, clientKey: newKey() })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const [registry] = useState(pendingRegistry);

  function change(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (!values.title.trim()) { setError('Enter a lesson title that is not blank.'); return; }
    if (registry.count()) {
      setError('A picture or video is still open. Press “Add to this activity” (or Done) to keep it, or Cancel to discard it, then save the lesson.');
      document.querySelector('[data-media-pending]')?.scrollIntoView({ block: 'center' });
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const body = { ...values, duration_minutes: values.duration_minutes === '' ? null : Number(values.duration_minutes) };
      if (lesson || media.length) body.media = mediaPayload(media);
      const response = await fetch(lesson ? `/api/lessons/${lesson.id}` : '/api/lessons', { method: lesson ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (response.status !== (lesson ? 200 : 201)) throw new Error(data.error || 'The server could not save this lesson.');
      if (!Number.isInteger(data.id)) throw new Error('The server did not confirm the saved lesson.');
      onSaved(data, body.media?.length);
    } catch (failure) {
      setError(failure instanceof TypeError || failure instanceof SyntaxError ? 'Could not confirm the save. Check the connection. If it was interrupted, reload and check your lessons before retrying; your input is still here.' : failure.message);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <PendingMedia.Provider value={registry}>
    <section className="form-panel" aria-labelledby="new-heading">
      <h2 id="new-heading">{lesson ? 'Edit saved lesson' : 'New lesson plan'}</h2>
      <p>Title and discipline are required. Add the details that help you coach.</p>
      <form onSubmit={submit}>
        <fieldset disabled={saving}>
          <legend className="sr-only">Lesson details</legend>
          <label>Lesson title<input autoFocus name="title" required maxLength={200} value={values.title} onChange={change} /></label>
          <div className="form-row">
            <label>Discipline<select name="discipline" required value={values.discipline} onChange={change}><option value="">Choose a discipline</option>{disciplines.map(name => <option key={name}>{name}</option>)}</select></label>
            <label>Skill level<select name="skill_level" value={values.skill_level} onChange={change}>{['Beginner', 'Intermediate', 'Advanced'].map(level => <option key={level}>{level}</option>)}</select></label>
            <label>Duration (minutes)<input name="duration_minutes" type="number" min="1" max="1440" step="1" value={values.duration_minutes} onChange={change} /><small>Optional · 1–1440 minutes</small></label>
          </div>
          {textFields.map(([name, label, limit]) => <label key={name}>{label}<textarea name={name} rows="3" maxLength={limit} value={values[name]} onChange={change} /><small>Optional · up to {limit.toLocaleString()} characters</small></label>)}
          <ActivityEditor value={values.drills} onChange={drills => setValues(current => ({ ...current, drills }))} media={media} onMediaChange={setMedia} />
          {activityMinutes(values.drills) > 0 && <p role="status" className="metadata">Activity minutes added up: {activityMinutes(values.drills)}{values.duration_minutes !== '' && ` of ${values.duration_minutes} class minutes`}{values.duration_minutes !== '' && activityMinutes(values.drills) !== Number(values.duration_minutes) && ' — they do not match yet. You can still save.'}</p>}
          <div className="actions"><button type="submit">{saving ? 'Saving…' : lesson ? 'Save changes' : 'Save lesson'}</button><button className="secondary" type="button" onClick={() => { media.forEach(discardUpload); onCancel(); }}>Cancel</button></div>
        </fieldset>
        {saving && <p role="status">Saving your lesson…</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </section>
    </PendingMedia.Provider>
  );
}
