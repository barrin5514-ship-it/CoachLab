import React, { useState } from 'react';
import { lessonMedia } from './lesson-media.js';

function Demonstration({ item }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  return <section className="demonstration">
    <h4>{item.title}</h4>
    {!imageFailed ? <img src={item.image} alt={item.title + ' reference picture'} onError={() => setImageFailed(true)} referrerPolicy="no-referrer" /> : <p>Picture unavailable. Open the instructor source below.</p>}
    <small>Picture and instruction: {item.credit}. Match the demonstration to your class and have a qualified coach review it.</small>
    {item.video && <button className="secondary" type="button" onClick={() => setShowVideo(value => !value)}>{showVideo ? 'Hide video' : 'Load instructional video'}</button>}
    {showVideo && <iframe title={item.title} src={item.video} allow="fullscreen; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
    <p><a href={item.source} target="_blank" rel="noopener noreferrer">Instructor source and pictures</a> · <a href={item.videoPage || item.video.replace('/embed/', '/watch?v=')} target="_blank" rel="noopener noreferrer">Watch on publisher site</a></p>
    <small>If playback is blocked or unavailable, use the source link. External media loads from its publisher only when this section is opened; videos require another click.</small>
  </section>;
}
export default function LessonMedia({ lesson }) {
  const [open, setOpen] = useState(false);
  const items = lessonMedia(lesson);
  const query = encodeURIComponent(`${lesson.discipline} ${lesson.title} technique`);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Instructional pictures and videos</summary>
    {open && (items.length ? items.map(item => <Demonstration key={item.source} item={item} />) : <p>No reviewed demonstration in CoachLab’s reference catalog matches this lesson yet. No links have been invented for it.</p>)}
    {open && <p className="search-links">Find more: <a href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noopener noreferrer">search instructional videos</a> · <a href={`https://www.google.com/search?tbm=isch&q=${query}`} target="_blank" rel="noopener noreferrer">search pictures</a>. Search results are not reviewed by CoachLab; have a qualified coach check them before teaching.</p>}
  </details>;
}
