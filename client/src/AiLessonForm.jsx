// Lets a coach generate, edit and explicitly approve an AI draft before saving it.
import React, { useRef, useState } from 'react';
import ActivityEditor from './ActivityEditor.jsx';
import MediaEditor, { PendingMedia, pendingRegistry } from './MediaEditor.jsx';
import { discardUpload, mediaPayload, newKey } from './media.js';
import { newDisciplines, levels, audiences, sectionGuidance, safetyGuidance, details, labels, validateRequest, validateDraft, toLesson } from './lesson-draft.js';

import FitnessFields from './FitnessFields.jsx';
import { emptyFitness } from './fitness.js';

const initial = { ...emptyFitness, audience: 'Unspecified', discipline: 'Brazilian Jiu-Jitsu', skill_level: 'Beginner', duration_minutes: 60, students: 2, objective: '', techniques: '', equipment: '', privacy_confirmed: false };
// Separates generation from approval so AI output cannot save itself.
export default function AiLessonForm({ onSaved, onCancel, defaults = {} }) {
  const [request, setRequest] = useState(() => ({ ...initial, ...defaults }));
  const [draft, setDraft] = useState(null);
  const [approved, setApproved] = useState(false);
  const [media, setMediaList] = useState([]);
  const [finding, setFinding] = useState(false);
  const [findNote, setFindNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const [registry] = useState(pendingRegistry);
  // Updates this draft field without saving to the database.
  function edit(key, value) {
    setDraft(current => ({ ...current, [key]: value }));
    // A newly generated draft always needs the coach's fresh approval.
    setApproved(false);
  }
  // Changing attachments clears approval so the coach reviews the new draft.
  function setMedia(next) {
    setMediaList(current => typeof next === 'function' ? next(current) : next);
    // A newly generated draft always needs the coach's fresh approval.
    setApproved(false);
  }
  // Combines sources and checks links before returning bounded media per activity.
  async function findMedia(source) {
    setFinding(true);
    setFindNote('');
    try {
      const response = await fetch('/api/media/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ discipline: request.discipline, sections: source.sections.map(section => ({ name: section.name, instructions: section.instructions.slice(0, 1500), queries: Array.isArray(section.media_queries) ? section.media_queries.filter(query => typeof query === 'string' && query.length <= 80).slice(0, 3) : [] })) }), signal: AbortSignal.timeout(60000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Media search failed.');
      setMediaList(current => [...current.filter(item => item.origin !== 'suggested'), ...data.media.map(item => ({ ...item, clientKey: newKey() }))]);
      setFindNote(data.media.length ? `CoachLab found ${data.media.length} picture${data.media.length === 1 ? '' : 's'} or video${data.media.length === 1 ? '' : 's'} and checked every link. Remove anything that does not fit your class.${data.notes.length ? ' ' + data.notes.join(' ') : ''}` : (data.notes.join(' ') || 'No matching verified pictures or videos were found.') + ' You can add your own below.');
    } catch (failure) {
      setFindNote(failure.name === 'Error' ? failure.message : 'Media search was interrupted. You can add pictures and videos yourself or search again.');
    } finally { setFinding(false); }
  }
  // Discards temporary uploads when the coach leaves this unsaved draft.
  function discard() {
    media.forEach(discardUpload);
    onCancel();
  }
  // Validates inputs, requires approval for saving, and refuses to lose pending attachment edits.
  async function submit(event) {
    event.preventDefault();
    if (locked.current) return;
    const invalid = draft ? validateDraft(draft, request) : validateRequest(request);
    if (invalid || (draft && !approved)) { setError(invalid || 'Review and approve the draft before saving.'); return; }
    // Do not save while an attachment editor still contains unfinished work.
    if (draft && registry.count()) {
      setError('A picture or video is still open. Press “Add to this activity” (or Done) to keep it, or Cancel to discard it, then save the lesson.');
      document.querySelector('[data-media-pending]')?.scrollIntoView({ block: 'center' });
      return;
    }
    const body = draft ? { ...toLesson(draft, request), media: mediaPayload(media.map(item => ({ ...item, activity: draft.sections.some(section => section.name === item.activity) ? `${item.activity} — ${draft.sections.find(section => section.name === item.activity).minutes} minutes` : '' }))) } : request;
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
        onSaved(data, body.media.length);
      } else {
        if (validateDraft(data.draft, request)) throw new Error('The server returned an invalid draft.');
        setDraft(data.draft);
        // A newly generated draft always needs the coach's fresh approval.
        setApproved(false);
        setMediaList([]);
        findMedia(data.draft);
      }
    } catch (failure) {
      setError(failure.name === 'Error' ? failure.message : 'Connection interrupted. Your input remains here. After a save interruption, check saved lessons in another tab before retrying to avoid duplicates.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <PendingMedia.Provider value={registry}>
    <section className="form-panel" aria-labelledby="ai-heading">
      <h2 id="ai-heading">{draft ? 'AI lesson draft — coach review required' : 'Generate a lesson draft'}</h2>
      <p>AI can make mistakes. A qualified coach must check safety, technique and suitability before using a lesson.</p>
      <p className="safety-guidance">{safetyGuidance(request)}</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <legend className="sr-only">AI lesson details</legend>
          {!draft ? <>
            <p>Send generic class details only: no names, contact details, health information or other personal athlete information. Google may use free-tier requests and responses to improve its products.</p>
            <div className="form-row">
              <label>Discipline<select value={request.discipline} onChange={event => setRequest({ ...request, ...emptyFitness, discipline: event.target.value })}>{newDisciplines.map(value => <option key={value}>{value}</option>)}</select></label>
              <label>Audience<select value={request.audience} onChange={event => setRequest({ ...request, audience: event.target.value })}>{audiences.map(value => <option key={value}>{value}</option>)}</select></label>
              <label>Skill level<select value={request.skill_level} onChange={event => setRequest({ ...request, skill_level: event.target.value })}>{levels.map(value => <option key={value}>{value}</option>)}</select></label>
              <label>Class duration (minutes)<input required type="number" min="15" max="180" step="1" value={request.duration_minutes} onChange={event => setRequest({ ...request, duration_minutes: Number(event.target.value) })} /></label>
            </div>
            <FitnessFields value={request} onChange={patch => setRequest(current => ({ ...current, ...patch }))} />
            <details><summary>Optional class details and instructions</summary><label>Number of students<input required type="number" min="1" max="100" step="1" value={request.students} onChange={event => setRequest({ ...request, students: Number(event.target.value) })} /></label>
            {[['objective', 'Training objective'], ['techniques', 'Specific techniques'], ['equipment', 'Available equipment']].map(([key, label]) => <label key={key}>{label}<textarea maxLength={500} value={request[key]} onChange={event => setRequest({ ...request, [key]: event.target.value })} /><small>Optional · leave blank for AI recommendations. Include any detailed preferences here.</small></label>)}
            </details><label className="check-label"><input type="checkbox" required checked={request.privacy_confirmed} onChange={event => setRequest({ ...request, privacy_confirmed: event.target.checked })} />I confirm these are generic class details without personal or sensitive athlete information.</label>
          </> : <>
            <p>{request.class_type && `${request.class_type === 'Other' ? request.class_type_other : request.class_type} · ${request.class_format || 'Format not specified'} · `}{request.audience} · {request.discipline} · {request.skill_level} · {request.students} students · {request.duration_minutes} minutes requested. Edits require fresh approval.</p>
            <label>Lesson title<input required maxLength={200} value={draft.title} onChange={event => edit('title', event.target.value)} /></label>
            <label>Training objectives<textarea required maxLength={1500} value={draft.objectives} onChange={event => edit('objectives', event.target.value)} /></label>
            {draft.sections.map((section, index) => <div key={section.name} className="draft-section">
              <h3>{section.name}</h3>
              <label>{section.name} minutes<input required type="number" min={index === 3 ? 0 : 1} max="180" step="1" value={section.minutes} onChange={event => edit('sections', draft.sections.map((item, position) => position === index ? { ...item, minutes: Number(event.target.value) } : item))} /></label>
              <ActivityEditor label={section.name + ' instructions'} limit={1000} value={section.instructions} onChange={instructions => edit('sections', draft.sections.map((item, position) => position === index ? { ...item, instructions } : item))} />
              {sectionGuidance.map(([key, label]) => <label key={key}>{section.name}: {label}<textarea required maxLength={200} value={section[key]} onChange={event => edit('sections', draft.sections.map((item, position) => position === index ? { ...item, [key]: event.target.value } : item))} /></label>)}
              <MediaEditor media={media} onChange={setMedia} activity={section.name} headings={draft.sections.map(item => item.name)} label={`${section.name} pictures and videos`} items={media.filter(item => item.activity === section.name)} />
            </div>)}
            <div className="draft-section">
              <MediaEditor media={media} onChange={setMedia} activity="" headings={draft.sections.map(item => item.name)} label="Whole-lesson pictures and videos" items={media.filter(item => !draft.sections.some(section => section.name === item.activity))} />
              {finding && <p role="status">Finding pictures and videos and checking every link…</p>}
              {findNote && !finding && <p role="status" className="metadata">{findNote}</p>}
              {!finding && <button type="button" className="secondary" onClick={() => findMedia(draft)}>Search for media again</button>}
            </div>
            <p role="status">Section total: {draft.sections.reduce((sum, section) => sum + section.minutes, 0)} / {request.duration_minutes} minutes</p>
            {details.map((key, index) => <label key={key}>{labels[index]}<textarea required maxLength={1000} value={draft[key]} onChange={event => edit(key, event.target.value)} /></label>)}
            <label className="check-label"><input type="checkbox" required checked={approved} onChange={event => setApproved(event.target.checked)} />I have reviewed and edited this draft for safe, appropriate coaching and approve saving it.</label>
          </>}
          <div className="actions"><button type="submit" disabled={!!draft && (!approved || finding)}>{busy ? 'Working…' : draft ? 'Approve and save lesson' : 'Generate draft'}</button><button type="button" className="secondary" onClick={discard}>{draft ? 'Discard draft' : 'Cancel'}</button></div>
        </fieldset>
        {busy && <p role="status">{draft ? 'Saving approved lesson…' : 'Generating an unsaved draft…'}</p>}
        {error && <p role="alert" className="error">{error}</p>}
      </form>
    </section>
    </PendingMedia.Provider>
  );
}
