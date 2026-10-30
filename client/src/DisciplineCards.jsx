// Displays the owner's photos as working shortcuts to existing lesson filters.
import React, { useState } from 'react';
import { disciplineCards } from './discipline-pages.js';
// A missing image reveals the dark CSS background instead of a broken icon.
export function DisciplinePhoto({ image }) {
  const [failed, setFailed] = useState(false);
  return !failed && image ? <img src={'/images/' + image + '.webp'} alt="" loading="lazy" decoding="async" width="960" height="640" onError={() => setFailed(true)} /> : null;
}
// Cards only navigate; they never create or change a lesson.
export default function DisciplineCards({ onSelect, disabled }) {
  return <section className="discipline-cards" aria-label="Choose your discipline">{disciplineCards.map(card => <button type="button" className="discipline-tile" data-photo={card.image} key={card.title} disabled={disabled} onClick={() => onSelect(card)}><DisciplinePhoto image={card.image} /><span className="tile-copy"><strong>{card.title}</strong><span>{card.description}</span></span></button>)}</section>;
}
