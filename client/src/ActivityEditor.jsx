// Edits activity cards in memory and keeps their pictures and videos with the matching headings.
import React, { useEffect, useRef, useState } from 'react';

import { activityBlocks, joinActivities, moveActivity } from './activities.js';
import MediaEditor from './MediaEditor.jsx';
import { headingOf, renameActivity, sameActivity, unassignedMedia } from './media.js';

// Keeps activities editable as separate cards while preserving the saved text format.
export default function ActivityEditor({ value, onChange, label = 'Exercises and activities', limit = 10000, media, onMediaChange }) {
  const nextId = useRef(0);
  // Assigns stable local IDs so editing one activity does not confuse React with another.
  const makeCards = text => activityBlocks(text).map(item => ({ id: nextId.current++, text: item }));
  const [cards, setCards] = useState(() => makeCards(value));
  const withMedia = Array.isArray(media) && onMediaChange;
  const headings = cards.map(card => headingOf(card.text));

  useEffect(() => {
    if (value !== joinActivities(cards.map(card => card.text))) setCards(makeCards(value));
  }, [value]);

  // Updates the cards and sends their combined text back to the parent form.
  function update(next) {
    setCards(next);
    onChange(joinActivities(next.map(card => card.text)));
  }
  // Keeps attachment headings in sync when the coach edits an activity title.
  function edit(card, text) {
    if (withMedia && headingOf(card.text) !== headingOf(text)) onMediaChange(current => renameActivity(current, headingOf(card.text), headingOf(text)));
    update(cards.map(item => item.id === card.id ? { ...item, text } : item));
  }
  // Moves one activity within the current list without dropping its text.
  function swap(index, direction) {
    const order = moveActivity(cards.map((_, position) => position), index, direction);
    update(order.map(position => cards[position]));
  }
  // Chooses an unused heading so attached media can identify the new activity.
  function addActivity() {
    let number = cards.length + 1;
    while (headings.includes(`New activity ${number} — add minutes`)) number += 1;
    update([...cards, { id: nextId.current++, text: `New activity ${number} — add minutes\nAdd coaching cues here.` }]);
  }
  return <section className="activity-editor" aria-label={label}>
    <h3>{label}</h3><p>Each card is one activity. Put a heading with its minutes on the first line, for example “Warm-up — 10 minutes”, then one coaching cue per line. Use Add activity for a new card.</p>
    {cards.map((card, index) => {
      const heading = headings[index];
      const unique = heading !== '' && headings.indexOf(heading) === index;
      return <div className="draft-section" key={card.id}>
        <label>{label} {index + 1}<textarea rows="4" maxLength={limit} value={card.text} onChange={event => edit(card, event.target.value)} /></label>
        {withMedia && <MediaEditor media={media} onChange={onMediaChange} activity={heading} headings={headings.filter(Boolean)} disabled={!unique}
          items={unique ? media.filter(item => sameActivity(item, heading)) : []}
          note={unique ? undefined : 'Give this activity its own first-line heading to attach pictures and videos to it.'} />}
        <div className="actions">
          <button type="button" className="secondary" disabled={index === 0} onClick={() => swap(index, -1)}>Move up {index + 1}</button>
          <button type="button" className="secondary" disabled={index === cards.length - 1} onClick={() => swap(index, 1)}>Move down {index + 1}</button>
          <button type="button" className="secondary" onClick={() => update(cards.filter(item => item.id !== card.id))}>Remove activity {index + 1}</button>
        </div>
      </div>;
    })}
    <button type="button" className="secondary" onClick={addActivity}>Add activity</button>
    <small>{value.length} / {limit} characters</small>
    {withMedia && <div className="draft-section">
      <MediaEditor media={media} onChange={onMediaChange} activity="" headings={headings.filter(Boolean)} label="Whole-lesson media" note="Pictures and videos that are not tied to one activity, including any whose activity was renamed or removed."
        items={unassignedMedia(media, headings)} />
    </div>}
  </section>;
}
