// Provides working discipline navigation and a matching local-photo header.
import React from 'react';
import { disciplineCards, disciplinePage } from './discipline-pages.js';
import { DisciplinePhoto } from './DisciplineCards.jsx';
export function DisciplineNavigation({ discipline, classType, onSelect, disabled }) {
  const destinations = [{ title: 'Dashboard', discipline: 'All' }, ...disciplineCards, { title: 'All Fitness', discipline: 'Fitness' }, { title: 'Legacy Personal Training', discipline: 'Personal Training' }];
  return <aside className="coach-sidebar"><strong className="sidebar-brand">CoachLab</strong><nav aria-label="Disciplines">{destinations.map(card => <button type="button" className="secondary" key={card.title} disabled={disabled} aria-pressed={discipline === card.discipline && classType === (card.classType || 'All')} onClick={() => onSelect(card)}>{card.title}</button>)}</nav></aside>;
}
export default function DisciplineHeader({ discipline, classType }) {
  const page = disciplinePage(discipline, classType);
  if (!page) return null;
  return <section className="discipline-header" aria-label={page.title + ' lesson plans'}><DisciplinePhoto key={page.image} image={page.image} /><div><h2>{page.title}</h2><p>{page.description || 'Your saved lessons and coaching plans'}</p></div></section>;
}
