// Edits a class and its coach-owned ladder without collecting athlete identities.
import React, { useEffect, useState } from 'react';
import { newDisciplines } from './lesson-draft.js';
import { emptyFitness } from './fitness.js';
import FitnessFields from './FitnessFields.jsx';
import { weekdays, validateClass, validateLevels } from './classes.js';
import { classApi } from './class-api.js';
const blank = { name: '', discipline: 'Boxing', audience: 'Adults', days: [], days_per_week: 1, goal: '', current_level: '', ...emptyFitness };
export default function ClassEditor({ item, onSaved, onCancel }) {
  const [value, setValue] = useState(() => Object.fromEntries(Object.keys(blank).map(key => [key, item?.[key] ?? blank[key]])));
  const [ladder, setLadder] = useState(null), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  // Cancel stale requests when discipline or audience changes; existing saved level is retained when valid.
  useEffect(() => {
    const controller = new AbortController(); setLadder(null); setDirty(false); setError('');
    classApi('class-ladder?' + new URLSearchParams({ discipline: value.discipline, audience: value.audience }), 'GET', undefined, controller.signal).then(data => {
      setLadder(data); setValue(current => ({ ...current, current_level: data.levels.some(level => level.id === current.current_level) ? current.current_level : data.levels[0].id }));
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [value.discipline, value.audience]);
  const patch = change => setValue(current => ({ ...current, ...change }));
  const editLevels = levels => { setLadder(current => ({ ...current, levels })); setDirty(true); };
  function move(index, delta) {
    const levels = [...ladder.levels]; [levels[index], levels[index + delta]] = [levels[index + delta], levels[index]]; editLevels(levels);
  }
  async function saveLadder() {
    const levels = ladder.levels.map(level => ({ ...level, name: level.name.trim(), skills: level.skills.map(skill => skill.trim()).filter(Boolean) }));
    const invalid = validateLevels(levels); if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try { setLadder(await classApi('class-ladder', 'PUT', { discipline: value.discipline, audience: value.audience, levels, revision: ladder.revision })); setDirty(false); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function save(event) {
    event.preventDefault(); const invalid = validateClass(value); if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try { await classApi('classes' + (item ? '/' + item.id : ''), item ? 'PUT' : 'POST', value); onSaved(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <form className="form-panel" onSubmit={save}><h3>{item ? 'Edit class' : 'Create class'}</h3><p>Use a group label, not children's names or personal information. Levels are coaching suggestions, not automatic belt or competition approval.</p><fieldset disabled={busy}><label>Class name<input required maxLength={100} value={value.name} onChange={event => patch({ name: event.target.value })} /></label><div className="form-row"><label>Discipline<select value={value.discipline} onChange={event => patch({ ...emptyFitness, discipline: event.target.value, current_level: '' })}>{[...newDisciplines, ...(item?.discipline === 'Personal Training' ? ['Personal Training'] : [])].map(name => <option key={name}>{name}</option>)}</select></label><label>Audience<select value={value.audience} onChange={event => patch({ audience: event.target.value, current_level: '' })}><option>Kids</option><option>Adults</option></select></label><label>Days per week<input required type="number" min="1" max="7" value={value.days_per_week} onChange={event => patch({ days_per_week: Number(event.target.value) })} /></label></div><FitnessFields value={value} onChange={patch} /><fieldset><legend>Which days?</legend><div className="class-days">{weekdays.map(day => <label className="check-label" key={day}><input type="checkbox" checked={value.days.includes(day)} onChange={event => patch({ days: event.target.checked ? [...value.days, day] : value.days.filter(item => item !== day) })} />{day}</label>)}</div></fieldset><label>Class goal<textarea maxLength={500} value={value.goal} onChange={event => patch({ goal: event.target.value })} /></label><label>Current level<select required disabled={!ladder} value={value.current_level} onChange={event => patch({ current_level: event.target.value })}><option value="">Choose a level</option>{ladder?.levels.map(level => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>{!ladder && !error && <p role="status">Loading your level ladder…</p>}
    {ladder && <details className="class-ladder"><summary>Edit my gym's level ladder</summary><p>This ladder is shared by your {value.audience.toLowerCase()} {value.discipline} classes only. Each class keeps its own current level. Save ladder changes before saving the class. Move any class off a level before removing it.</p>{ladder.levels.map((level, index) => <div className="draft-section" key={level.id}><label>Level name<input maxLength={60} value={level.name} onChange={event => editLevels(ladder.levels.map(item => item.id === level.id ? { ...item, name: event.target.value } : item))} /></label><label>Skills required (optional, one per line)<textarea value={level.skills.join('\n')} onChange={event => editLevels(ladder.levels.map(item => item.id === level.id ? { ...item, skills: event.target.value.split('\n') } : item))} /></label><div className="actions"><button type="button" className="secondary" disabled={index === 0} onClick={() => move(index, -1)}>Move up</button><button type="button" className="secondary" disabled={index === ladder.levels.length - 1} onClick={() => move(index, 1)}>Move down</button><button type="button" className="secondary" disabled={ladder.levels.length === 1} onClick={() => editLevels(ladder.levels.filter(item => item.id !== level.id))}>Remove level</button></div></div>)}<div className="actions"><button type="button" className="secondary" disabled={ladder.levels.length >= 30} onClick={() => editLevels([...ladder.levels, { id: crypto.randomUUID(), name: 'New level', skills: [] }])}>Add level</button><button type="button" disabled={!dirty} onClick={saveLadder}>Save ladder</button></div></details>}
    <div className="actions"><button type="submit" disabled={!ladder || dirty}>Save class</button><button type="button" className="secondary" onClick={onCancel}>Cancel</button></div></fieldset>{error && <p role="alert" className="error">{error}</p>}</form>;
}
