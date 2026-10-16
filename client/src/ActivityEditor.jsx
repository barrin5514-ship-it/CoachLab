import React from 'react';

import { activityBlocks, moveActivity } from './activities.js';

export default function ActivityEditor({ value, onChange, label = 'Exercises and activities', limit = 10000 }) {
  const items = activityBlocks(value);
  function update(next) { onChange(next.join('\n\n')); }
  return <section className="activity-editor" aria-label={label}>
    <h3>{label}</h3><p>Each card is an activity or section. Include a heading, minutes, and one coaching cue per line.</p>
    {items.map((item, index) => <div className="draft-section" key={index}>
      <label>{label} {index + 1}<textarea rows="4" maxLength={limit} value={item} onChange={event => update(items.map((text, position) => position === index ? event.target.value : text))} /></label>
      <div className="actions">
        <button type="button" className="secondary" disabled={index === 0} onClick={() => update(moveActivity(items, index, -1))}>Move up {index + 1}</button>
        <button type="button" className="secondary" disabled={index === items.length - 1} onClick={() => update(moveActivity(items, index, 1))}>Move down {index + 1}</button>
        <button type="button" className="secondary" onClick={() => update(items.filter((_, position) => position !== index))}>Remove activity {index + 1}</button>
      </div>
    </div>)}
    <button type="button" className="secondary" onClick={() => update([...items, 'New activity — add minutes\nAdd coaching cues here.'])}>Add activity</button>
    <small>{value.length} / {limit} characters</small>
  </section>;
}
