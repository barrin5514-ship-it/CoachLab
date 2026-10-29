import React, { useRef, useState } from 'react';
import MediaItem from './MediaItem.jsx';
import { mediaLimits, youtubeId } from './media.js';

export default function VideoSuggestions({ lesson, media, onApprove, disabled }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  async function suggest() {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/lessons/${lesson.id}/videos`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Video search is unavailable.');
      setResult(data);
    } catch (failure) { setError(failure instanceof TypeError ? 'Could not reach video search. Try later.' : failure.message); }
    finally { running.current = false; setBusy(false); }
  }
  return <section aria-label="Video suggestions">
    <button type="button" className="secondary" disabled={disabled || busy} onClick={suggest}>{busy ? 'Finding videos…' : 'Suggest videos'}</button>
    {result && <><p role="status">{result.message}</p><ul className="media-list">{result.videos.map(item => {
      const attached = media.some(entry => youtubeId(entry.url) === youtubeId(item.url));
      return <li key={item.url}><MediaItem item={item} /><button type="button" disabled={disabled || attached || media.length >= mediaLimits.perLesson} onClick={() => onApprove(item)}>{attached ? 'Already attached' : 'Add'}</button></li>;
    })}</ul><button type="button" className="secondary" onClick={() => setResult(null)}>Close suggestions</button></>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
