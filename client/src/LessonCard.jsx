import React from 'react';

export default function LessonCard({ lesson }) {
  return (
    <article className="lesson-card">
      <span className="discipline">{lesson.discipline}</span>
      <h3>{lesson.title}</h3>
      <p className="metadata">{lesson.skill_level} · {lesson.duration_minutes === null ? 'Duration not set' : `${lesson.duration_minutes} min`}</p>
      <dl>
        <dt>Training goal</dt><dd>{lesson.goal || 'Not added'}</dd>
        <dt>Drills / instructions</dt><dd>{lesson.drills || 'Not added'}</dd>
        <dt>Coaching notes</dt><dd>{lesson.coaching_notes || 'Not added'}</dd>
      </dl>
      <footer>Created <time dateTime={lesson.created_at}>{new Date(lesson.created_at).toLocaleString()}</time></footer>
    </article>
  );
}
