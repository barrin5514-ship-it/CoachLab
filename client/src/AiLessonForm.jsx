import React, { useRef, useState } from 'react';
import ActivityEditor from './ActivityEditor.jsx';
import { disciplines, levels, details, labels, validateRequest, validateDraft, toLesson } from './lesson-draft.js';

const initial = { discipline: 'Brazilian Jiu-Jitsu', skill_level: 'Beginner', duration_minutes: 60, students: 2, objective: '', techniques: '', equipment: '', privacy_confirmed: false };
export default function AiLessonForm({ onSaved, onCancel }) {
  const [request, setRequest] = useState(initial);
  const [draft, setDraft] = useState(null);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  function edit(key, value) {
    setDraft(current => ({ ...current, [key]: value }));
    setApproved(false);
  }
  async function submit(event) {
    event.preventDefault();
    if (locked.current) return;
    const invalid = draft ? validateDraft(draft, request) : validateRequest(request);
    if (invalid || (draft && !approved)) { setError(invalid || 'Review and approve the draft before saving.'); return; }
    const body = draft ? toLesson(draft, request) : request;
    if (new TextEncoder().encode(JSON.stringify(body)).length > 32000) { setError('This lesson is too large. Shorten the instructions before saving.'); return; }
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(draft ? '/api/lessons' : '/api/ai/lesson-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The request failed. Please try again.');
      if (draft) {
        if (response.status !== 201 || !Number.isInteger(data.id)) throw new Error('The server did not confirm the save.');
        onSaved(data);
      } else {
        if (validateDraft(data.draft, request)) throw new Error('The server returned an invalid draft.');
        setDraft(data.draft);
        setApproved(false);
      }
    } catch (failure) {
      setError(failure.name === 'Error' ? failure.message : 'Connection interrupted. Your input remains here. After a save interruption, check saved lessons in another tab before retrying to avoid duplicates.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="form-panel" aria-labelledby="ai-heading">
      <h2 id="ai-heading">{draft ? 'AI lesson draft — coach review required' : 'Generate a lesson draft'}</h2>
      <p>AI can make mistakes. A qualified coach must check safety, technique and suitability before using a lesson.</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <legend className="sr-only">AI lesson details</legend>
          {!draft ? <>
            <p>Send generic class details only: no names, contact details, health information or other personal athlete information. Google may use free-tier requests and responses to improve its products.</p>
            <div className="form-row">
              <label>Discipline<select value={request.discipline} onChange={event => setRequest({ ...request, discipline: event.target.value })}>{disciplines.map(value => <option key={value}>{value}</option>)}</select></label>
              <label>Skill level<select value={request.skill_level} onChange={event => setRequest({ ...request, skill_level: event.target.value })}>{levels.map(value => <option key={value}>{value}</option>)}</select></label>
              <label>Class duration (minutes)<input required type="number" min="15" max="180" step="1" value={request.duration_minutes} onChange={event => setRequest({ ...request, duration_minutes: Number(event.target.value) })} /></label>
            </div>
            <details><summary>Optional class details and instructions</summary><label>Number of students<input required type="number" min="1" max="100" step="1" value={request.students} onChange={event => setRequest({ ...request, students: Number(event.target.value) })} /></label>
            {[['objective', 'Training objective'], ['techniques', 'Specific techniques'], ['equipment', 'Available equipment']].map(([key, label]) => <label key={key}>{label}<textarea maxLength={500} value={request[key]} onChange={event => setRequest({ ...request, [key]: event.target.value })} /><small>Optional · leave blank for AI recommendations. Include any detailed preferences here.</small></label>)}
            </details><label className="check-label"><input type="checkbox" required checked={request.privacy_confirmed} onChange={event => setRequest({ ...request, privacy_confirmed: event.target.checked })} />I confirm these are generic class details without personal or sensitive athlete information.</label>
          </> : <>
            <p>{request.discipline} · {request.skill_level} · {request.students} students · {request.duration_minutes} minutes requested. Edits require fresh approval.</p>
            <label>Lesson title<input required maxLength={200} value={draft.title} onChange={event => edit('title', event.target.value)} /></label>
            <label>Training objectives<textarea required maxLength={1500} value={draft.objectives} onChange={event => edit('objectives', event.target.value)} /></label>
            {draft.sections.map((section, index) => <div key={section.name} className="draft-section">
              <h3>{section.name}</h3>
              <label>{section.name} minutes<input required type="number" min={index === 3 ? 0 : 1} max="180" step="1" value={section.minutes} onChange={event => edit('sections', draft.sections.map((item, position) => position === index ? { ...item, minutes: Number(event.target.value) } : item))} /></label>
              <ActivityEditor label={section.name + ' instructions'} limit={1500} value={section.instructions} onChange={instructions => edit('sections', draft.sections.map((item, position) => position === index ? { ...item, instructions } : item))} />
            </div>)}
            <p role="status">Section total: {draft.sections.reduce((sum, section) => sum + section.minutes, 0)} / {request.duration_minutes} minutes</p>
            {details.map((key, index) => <label key={key}>{labels[index]}<textarea required maxLength={1000} value={draft[key]} onChange={event => edit(key, event.target.value)} /></label>)}
            <label className="check-label"><input type="checkbox" required checked={approved} onChange={event => setApproved(event.target.checked)} />I have reviewed and edited this draft for safe, appropriate coaching and approve saving it.</label>
          </>}
          <div className="actions"><button type="submit" disabled={!!draft && !approved}>{busy ? 'Working…' : draft ? 'Approve and save lesson' : 'Generate draft'}</button><button type="button" className="secondary" onClick={onCancel}>{draft ? 'Discard draft' : 'Cancel'}</button></div>
        </fieldset>
        {busy && <p role="status">{draft ? 'Saving approved lesson…' : 'Generating an unsaved draft…'}</p>}
        {error && <p role="alert" className="error">{error}</p>}
      </form>
    </section>
  );
}
