import React, { useState } from 'react';
import LessonMedia from './LessonMedia.jsx';
import MediaItem from './MediaItem.jsx';
import { activityBlocks, activityMinutes } from './activities.js';
import { groupMedia, mediaKey } from './media.js';

export function CoachingText({ text, after }) {
  if (!text) return <p>Not added</p>;
  return <>{text.split(/\n\s*\n/).map((block, index) => {
    const lines = block.split('\n').filter(Boolean);
    const heading = lines.length > 1 && /(?:minutes|:)$/.test(lines[0].trim());
    return <section className="coaching-block" key={index}>
      {heading && <h4>{lines[0]}</h4>}
      <ul>{(heading ? lines.slice(1) : lines).map((line, position) => <li key={position}>{line.length > 240 ? <details><summary>{line.slice(0, 100)}…</summary><p>{line}</p></details> : line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')}</li>)}</ul>
      {after?.(index)}
    </section>;
  })}</>;
}
export default function LessonCard({ lesson, onEdit, onDeleted, disabled, media = [] }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { byBlock, rest } = groupMedia(media, activityBlocks(lesson.drills));
  const gallery = items => items?.length ? <ul className="media-list">{items.map(item => <li key={mediaKey(item)}><MediaItem item={item} /></li>)}</ul> : null;
  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/lessons/${lesson.id}`, { method: 'DELETE' });
      if (response.status !== 204 && response.status !== 404) throw new Error();
      onDeleted();
    } catch { setError('Could not confirm deletion. Check the connection and refresh before retrying.'); }
    finally { setBusy(false); }
  }
  return <article className="lesson-card" id={`lesson-${lesson.id}`}>
    <span className="discipline">{lesson.discipline}</span><h3>{lesson.title}</h3>
    <p className="metadata">{lesson.skill_level} · {lesson.duration_minutes === null ? 'Duration not set' : `${lesson.duration_minutes} min`}{activityMinutes(lesson.drills) > 0 && ` · activities total ${activityMinutes(lesson.drills)} min`}</p>
    <h4>Training goal</h4><CoachingText text={lesson.goal} />
    <h4>Activities and demonstrations</h4><CoachingText text={lesson.drills} after={index => gallery(byBlock.get(index))} />{rest.length > 0 && <><h4>Pictures and videos for the whole lesson</h4>{gallery(rest)}</>}
    <details><summary>Coaching notes, modifications and safety</summary><CoachingText text={lesson.coaching_notes} /></details>
    <LessonMedia lesson={lesson} />
    <div className="actions"><button className="secondary" disabled={disabled || busy} onClick={onEdit}>Edit lesson</button><button className="secondary danger" disabled={disabled || busy} onClick={() => setConfirming(true)}>Delete lesson</button></div>
    {confirming && <div className="error" role="alert"><p>Delete “{lesson.title}”? This permanently removes this saved lesson.</p><div className="actions"><button disabled={busy || disabled} onClick={remove}>Confirm delete</button><button className="secondary" disabled={busy} onClick={() => setConfirming(false)}>Keep lesson</button></div></div>}
    {error && <p className="error" role="alert">{error}</p>}
    <footer>Created <time dateTime={lesson.created_at}>{new Date(lesson.created_at).toLocaleString()}</time></footer>
  </article>;
}
