// Keeps search results open for multi-selection; approval opens the editor rather than saving.
import React, { useRef, useState } from 'react';
import MediaItem from './MediaItem.jsx';
import { mediaLimits, youtubeId } from './media.js';

// Keeps suggestions and selections local until explicit batch approval.
export default function VideoSuggestions({ lesson, media, onApprove, disabled }) {
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  // Runs one search and keeps its results for repeated selection without spending more quota.
  async function suggest() {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/lessons/${lesson.id}/videos`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Video search is unavailable.');
      setResult(data); setSelected([]);
    } catch (failure) { setError(failure instanceof TypeError ? 'Could not reach video search. Try later.' : failure.message); }
    finally { running.current = false; setBusy(false); }
  }
  // Passes the chosen verified batch to the editor; failed opening keeps the choices available.
  async function approveSelected() {
    if (running.current || !selected.length) return;
    running.current = true; setBusy(true); setError('');
    try {
      // Select from the already fetched results; approval must not issue another YouTube search.
      const approved = result.videos.filter(item => selected.includes(item.url) && !item.link_only);
      if (await onApprove(approved) !== false) { setResult(null); setSelected([]); }
      else setError('Could not open the editor. Your selection is kept; try again.');
    } catch { setError('Could not add the selected videos. Your selection is kept; try again.'); }
    finally { running.current = false; setBusy(false); }
  }
  return <section aria-label="Video suggestions">
    <button type="button" className="secondary" disabled={disabled || busy || !!result} onClick={suggest}>{busy ? 'Finding videos…' : 'Suggest videos'}</button>
    {result && <><p role="status">{result.message}</p><ul className="media-list">{result.videos.map(item => {
      const attached = media.some(entry => youtubeId(entry.url) === youtubeId(item.url));
      const chosen = selected.includes(item.url);
      return <li key={item.url}>
        {item.link_only ? <><strong>{item.title}</strong><p>Playback could not be verified. This video may be blocked or unavailable.</p><a href={item.url} target="_blank" rel="noopener noreferrer">Watch on YouTube</a></> : <MediaItem item={item} />}
        <label className="video-choice"><input type="checkbox" checked={chosen} disabled={disabled || busy || item.link_only || attached || (!chosen && media.length + selected.length >= mediaLimits.perLesson)} onChange={() => setSelected(current => current.includes(item.url) ? current.filter(url => url !== item.url) : [...current, item.url])} />{item.link_only ? 'Playback unverified' : attached ? 'Already attached' : 'Select video'}</label>
      </li>;
    })}</ul><p role="status">{selected.length} selected</p>
      <button type="button" disabled={disabled || busy || !selected.length} onClick={approveSelected}>Add selected</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => { setResult(null); setSelected([]); }}>Close suggestions</button></>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
