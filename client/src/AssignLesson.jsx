// Links a saved lesson to selected classes without changing lesson content.
import React, { useState } from 'react';
import { classApi } from './class-api.js';
export default function AssignLesson({ lessonId, disabled, onAssigned }) {
  const [classes, setClasses] = useState(null), [selected, setSelected] = useState([]);
  const [date, setDate] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function open() {
    setBusy(true); setMessage('');
    try { setClasses((await classApi('classes')).filter(item => !item.archived)); setSelected([]); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function assign(event) {
    if (event.currentTarget?.checkValidity && !event.currentTarget.checkValidity()) { event.preventDefault(); setMessage('Choose a saved lesson or class and leave the date completely blank or enter a valid date.'); return; }
    event.preventDefault(); setBusy(true); setMessage('');
    try { const result = await classApi('class-assignments', 'POST', { class_ids: selected, lesson_id: lessonId, scheduled_date: date || null, progression: true }); onAssigned?.(); setClasses(null); setMessage(['Lesson linked to the selected classes. The original is unchanged.', ...(result.progression_messages || [])].join(' ')); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <div className="class-assignment"><button type="button" className="secondary" disabled={disabled || busy} onClick={open}>Add to class</button>{classes && <form noValidate onSubmit={assign}><fieldset disabled={disabled || busy}><legend>Choose your classes</legend><p>Gemini may create one next-day progression per class. Only assign generic coaching content without personal athlete details. Coach review is required before teaching.</p>{classes.length === 0 && <p>Create an active class on the Classes page first.</p>}{classes.map(item => <label className="check-label" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />{item.name}</label>)}<label>Optional lesson date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><small>This sets the date for each selected link. A blank date starts the next full upcoming class week.</small><div className="actions"><button disabled={!selected.length} type="submit">Assign lesson</button><button type="button" className="secondary" onClick={() => setClasses(null)}>Cancel</button></div></fieldset></form>}{message && <p role="status">{message}</p>}</div>;
}
