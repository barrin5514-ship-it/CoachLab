import React, { useState } from 'react';
import MediaItem from './MediaItem.jsx';
import { checkLink, discardUpload, mediaKey, mediaLimits, newKey, uploadFile, uploadTypes } from './media.js';

const accept = Object.keys(uploadTypes).join(',');

function LinkChecker({ initial = '', onVerified, onCancel, action }) {
  const [text, setText] = useState(initial);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState(null);
  const [title, setTitle] = useState('');
  async function check() {
    if (checking) return;
    setError(''); setFound(null); setChecking(true);
    try {
      const info = await checkLink(text);
      setFound(info);
      setTitle(info.title || '');
    } catch (failure) { setError(failure.message); }
    finally { setChecking(false); }
  }
  return <div className="media-panel-body">
    <label>Picture or YouTube link
      <input type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=… or https://…/picture.jpg" value={text} maxLength={mediaLimits.url} disabled={checking}
        onChange={event => { setText(event.target.value); setFound(null); setError(''); }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); check(); } }} />
      <small>CoachLab checks that the link really is a picture, video or YouTube video before it is added.</small>
    </label>
    <div className="actions">
      <button type="button" disabled={checking || !text.trim()} onClick={check}>{checking ? 'Checking link…' : 'Check link'}</button>
      <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {found && <div className="media-found" role="status">
      <p className="success">Link checked — this is a {found.kind === 'youtube' ? 'YouTube video' : found.kind === 'image' ? 'picture' : 'video'}. Preview:</p>
      <MediaItem item={{ ...found, origin: 'link', title }} />
      <label>Caption<input value={title} maxLength={mediaLimits.title} onChange={event => setTitle(event.target.value)} /></label>
      <button type="button" onClick={() => onVerified({ ...found, title })}>{action}</button>
    </div>}
  </div>;
}

function Attachment({ item, headings, onChange, onRemove, disabled }) {
  const [editing, setEditing] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const [draft, setDraft] = useState({ title: '', activity: '' });
  const isLink = item.origin !== 'upload';
  return <li className="media-attachment">
    <MediaItem key={`${item.url}-${item.kind}`} item={item} />
    {!editing && <div className="actions">
      <button type="button" className="secondary" disabled={disabled} onClick={() => { setDraft({ title: item.title || '', activity: headings.includes((item.activity || '').trim()) ? item.activity.trim() : '' }); setEditing(true); }} aria-label={`Edit ${item.title || 'media'}`}>Edit</button>
      <button type="button" className="secondary danger" disabled={disabled} onClick={onRemove} aria-label={`Remove ${item.title || 'media'}`}>Remove</button>
    </div>}
    {editing && !relinking && <div className="media-edit">
      <label>Caption<input value={draft.title} maxLength={mediaLimits.title} onChange={event => setDraft({ ...draft, title: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} /></label>
      <label>Show with
        <select value={draft.activity} onChange={event => setDraft({ ...draft, activity: event.target.value })}>
          <option value="">Whole lesson (not one activity)</option>
          {headings.map(heading => <option key={heading} value={heading}>{heading}</option>)}
        </select>
      </label>
      <div className="actions">
        {isLink && <button type="button" className="secondary" onClick={() => setRelinking(true)}>Change link</button>}
        <button type="button" onClick={() => { setEditing(false); onChange(draft); }}>Done</button>
        <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>}
    {editing && relinking && <LinkChecker initial={item.url} action="Use this link" onCancel={() => setRelinking(false)} onVerified={info => { onChange({ replace: { ...info, origin: 'link', activity: item.activity || '' } }); setRelinking(false); setEditing(false); }} />}
  </li>;
}

export default function MediaEditor({ media, onChange, items, activity = '', headings = [], label, disabled = false, note }) {
  const [panel, setPanel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const full = media.length >= mediaLimits.perLesson;
  const add = list => onChange([...media, ...list.map(entry => ({ ...entry, activity, clientKey: newKey() }))]);

  async function upload(event) {
    const files = [...event.target.files];
    event.target.value = '';
    if (!files.length) return;
    setError('');
    if (media.length + files.length > mediaLimits.perLesson) { setError(`A lesson can have at most ${mediaLimits.perLesson} pictures and videos.`); return; }
    for (const file of files) {
      const kind = uploadTypes[file.type];
      if (!kind) { setError(`“${file.name}” is not a supported file. Use PNG, JPEG, GIF or WebP pictures, or MP4 or WebM videos.`); return; }
      if (file.size > mediaLimits[kind]) { setError(`“${file.name}” is too large. Pictures can be up to 6 MB and videos up to 20 MB; use a YouTube link for longer videos.`); return; }
    }
    setBusy(true);
    const added = [];
    try {
      for (const file of files) added.push({ ...(await uploadFile(file)), pending: true });
      add(added);
      setPanel(null);
    } catch (failure) {
      for (const item of added) discardUpload(item);
      setError(failure.message);
    } finally { setBusy(false); }
  }
  function change(item, patch) {
    if (patch.replace) {
      discardUpload(item);
      onChange(media.map(entry => mediaKey(entry) === mediaKey(item) ? { ...patch.replace, clientKey: newKey(), title: patch.replace.title } : entry));
      return;
    }
    onChange(media.map(entry => mediaKey(entry) === mediaKey(item) ? { ...entry, ...patch } : entry));
  }
  function remove(item) {
    discardUpload(item);
    onChange(media.filter(entry => mediaKey(entry) !== mediaKey(item)));
  }
  return <div className="media-editor">
    {label && <h4>{label}</h4>}
    {note && <small>{note}</small>}
    {items.length > 0 && <ul className="media-list">{items.map(item => <Attachment key={mediaKey(item)} item={item} headings={headings} disabled={disabled} onChange={patch => change(item, patch)} onRemove={() => remove(item)} />)}</ul>}
    {items.length === 0 && <small>No pictures or videos yet.</small>}
    {!panel && <button type="button" className="secondary add-media" disabled={disabled || full || busy} onClick={() => { setPanel('choose'); setError(''); }}>{full ? 'Media limit reached' : 'Add Media'}</button>}
    {panel && <div className="media-panel">
      <div className="actions" role="group" aria-label="How to add media">
        <button type="button" className={panel === 'upload' ? '' : 'secondary'} aria-pressed={panel === 'upload'} disabled={busy} onClick={() => { setPanel('upload'); setError(''); }}>Upload picture or video</button>
        <button type="button" className={panel === 'link' ? '' : 'secondary'} aria-pressed={panel === 'link'} disabled={busy} onClick={() => { setPanel('link'); setError(''); }}>Paste a link</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => setPanel(null)}>Close</button>
      </div>
      {panel === 'choose' && <small>Choose how to add a picture or video: upload a file from this device, or paste a YouTube or picture link.</small>}
      {panel === 'upload' && <div className="media-panel-body">
        <label>Choose files
          <input type="file" accept={accept} multiple disabled={busy} onChange={upload} />
          <small>PNG, JPEG, GIF, WebP pictures up to 6 MB. MP4 or WebM videos up to 20 MB. Longer videos: use a YouTube link.</small>
        </label>
        {busy && <p role="status">Uploading and checking the file…</p>}
      </div>}
      {panel === 'link' && <LinkChecker action="Add to this activity" onCancel={() => setPanel(null)} onVerified={info => { add([{ ...info, origin: 'link' }]); setPanel(null); }} />}
      {error && <p className="error" role="alert">{error}</p>}
    </div>}
  </div>;
}
