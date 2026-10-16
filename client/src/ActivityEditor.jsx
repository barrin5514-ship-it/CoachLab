import React, { useEffect, useRef, useState } from 'react';

import { activityBlocks, joinActivities, moveActivity } from './activities.js';

export default function ActivityEditor({ value, onChange, label = 'Exercises and activities', limit = 10000 }) {
  const nextId = useRef(0);
  const makeCards = text => activityBlocks(text).map(item => ({ id: nextId.current++, text: item }));
  const [cards, setCards] = useState(() => makeCards(value));

  useEffect(() => {
    if (value !== joinActivities(cards.map(card => card.text))) setCards(makeCards(value));
  }, [value]);

  function update(next) {
    setCards(next);
    onChange(joinActivities(next.map(card => card.text)));
  }
  function swap(index, direction) {
    const order = moveActivity(cards.map((_, position) => position), index, direction);
    update(order.map(position => cards[position]));
  }
  return <section className="activity-editor" aria-label={label}>
    <h3>{label}</h3><p>Each card is one activity. Put a heading with its minutes on the first line, for example “Warm-up — 10 minutes”, then one coaching cue per line. Use Add activity for a new card.</p>
    {cards.map((card, index) => <div className="draft-section" key={card.id}>
      <label>{label} {index + 1}<textarea rows="4" maxLength={limit} value={card.text} onChange={event => update(cards.map(item => item.id === card.id ? { ...item, text: event.target.value } : item))} /></label>
      <div className="actions">
        <button type="button" className="secondary" disabled={index === 0} onClick={() => swap(index, -1)}>Move up {index + 1}</button>
        <button type="button" className="secondary" disabled={index === cards.length - 1} onClick={() => swap(index, 1)}>Move down {index + 1}</button>
        <button type="button" className="secondary" onClick={() => update(cards.filter(item => item.id !== card.id))}>Remove activity {index + 1}</button>
      </div>
    </div>)}
    <button type="button" className="secondary" onClick={() => update([...cards, { id: nextId.current++, text: 'New activity — add minutes\nAdd coaching cues here.' }])}>Add activity</button>
    <small>{value.length} / {limit} characters</small>
  </section>;
}
