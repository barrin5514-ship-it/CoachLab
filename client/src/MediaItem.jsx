import React, { useState } from 'react';
import { attachmentSrc, formatSize, originLabel, safeLink, youtubeId } from './media.js';

export default function MediaItem({ item }) {
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const src = attachmentSrc(item);
  const id = item.kind === 'youtube' ? youtubeId(item.url) : null;
  const title = item.title || (item.kind === 'image' ? 'Lesson picture' : 'Lesson video');
  const original = safeLink(item.origin === 'upload' ? null : item.url);
  const credit = safeLink(item.source_page);
  return <figure className="media-item">
    {failed && <p className="media-fallback" role="status">This {item.kind === 'image' ? 'picture' : 'video'} could not be loaded.{original && <> <a href={original} target="_blank" rel="noopener noreferrer">Open the original link</a>.</>}</p>}
    {!failed && item.kind === 'image' && <img src={src} alt={title} referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    {!failed && item.kind === 'video' && <video controls preload="metadata" playsInline src={src} onError={() => setFailed(true)} aria-label={title} />}
    {item.kind === 'youtube' && id && (playing
      ? <div className="media-frame"><iframe title={title} src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
      : <button type="button" className="media-play" onClick={() => setPlaying(true)} aria-label={`Play video: ${title}`}><img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" referrerPolicy="no-referrer" /><span aria-hidden="true">▶</span></button>)}
    <figcaption>
      <strong>{title}</strong>
      <small>{originLabel(item)}{item.kind === 'youtube' && ' · YouTube video'}{item.size_bytes ? ` · ${formatSize(item.size_bytes)}` : ''}</small>
      {item.credit && <small>{item.credit}</small>}
      {(original || credit) && <small>{original && <a href={original} target="_blank" rel="noopener noreferrer">{item.kind === 'youtube' ? 'Watch on YouTube' : 'Open original'}</a>}{original && credit && credit !== original && ' · '}{credit && credit !== original && <a href={credit} target="_blank" rel="noopener noreferrer">Source and credit</a>}</small>}
    </figcaption>
  </figure>;
}
