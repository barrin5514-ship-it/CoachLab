// Checks and stages attachments so unfinished media edits are not silently lost on save.
import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import MediaItem from './MediaItem.jsx';
import { checkLink, discardUpload, mediaKey, mediaLimits, newKey, uploadFile, uploadTypes } from './media.js';

const accept = Object.keys(uploadTypes).join(',');
const detached = 'coachlab-media-fields';

export const PendingMedia = createContext(null);

// Tracks unfinished attachment edits so saving cannot silently drop them.
export function pendingRegistry() {
  const open = new Set();
  return { set: (id, active) => { if (active) open.add(id); else open.delete(id); }, count: () => open.size };
}

// Registers pending media work and removes it when the editor closes.
function useReportPending(active) {
  const registry = useContext(PendingMedia);
  const id = useId();
  useEffect(() => {
    registry?.set(id, active);
    return () => registry?.set(id, false);
  }, [registry, id, active]);
}

// Checks a link before the coach can attach it.
function LinkChecker({ initial = '', onVerified, onCancel, action }) {
  const [text, setText] = useState(initial);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState(null);
  const [title, setTitle] = useState('');
  useReportPending(checking || !!found);
  // Waits for server verification before presenting an attachment for approval.
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
  return <div className="media-panel-body" data-media-pending={checking || found ? 'true' : undefined}>
    <label>Picture or YouTube link
      <input form={detached} type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=… or https://…/picture.jpg" value={text} maxLength={mediaLimits.url} disabled={checking}
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
      <label>Caption<input form={detached} value={title} maxLength={mediaLimits.title} onChange={event => setTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} /></label>
      <button type="button" onClick={() => onVerified({ ...found, title })}>{action}</button>
    </div>}
  </div>;
}

// Keeps caption and link edits local until the coach confirms them.
function Attachment({ item, headings, onChange, onRemove, disabled }) {
  const [editing, setEditing] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const [draft, setDraft] = useState({ title: '', activity: '' });
  const isLink = item.origin !== 'upload';
  useReportPending(editing);
  return <li className="media-attachment">
    <MediaItem key={`${item.url}-${item.kind}`} item={item} />
    {!editing && <div className="actions">
      <button type="button" className="secondary" disabled={disabled} onClick={() => { setDraft({ title: item.title || '', activity: headings.includes((item.activity || '').trim()) ? item.activity.trim() : '' }); setEditing(true); }} aria-label={`Edit ${item.title || 'media'}`}>Edit</button>
      <button type="button" className="secondary danger" disabled={disabled} onClick={onRemove} aria-label={`Remove ${item.title || 'media'}`}>Remove</button>
    </div>}
    {editing && !relinking && <div className="media-edit" data-media-pending="true">
      <label>Caption<input form={detached} value={draft.title} maxLength={mediaLimits.title} onChange={event => setDraft({ ...draft, title: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} /></label>
      <label>Show with
        <select form={detached} value={draft.activity} onChange={event => setDraft({ ...draft, activity: event.target.value })}>
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

// Stages media changes in the lesson editor instead of immediately replacing saved attachments.
export default function MediaEditor({ media, onChange, items, activity = '', headings = [], label, disabled = false, note }) {
  const [panel, setPanel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState('');
  const addedRef = useRef(null);
  const full = media.length >= mediaLimits.perLesson;
  useReportPending(busy);
  useEffect(() => { if (added) addedRef.current?.scrollIntoView({ block: 'nearest' }); }, [added]);
  // Adds checked attachments to the current in-memory editor list.
  const add = list => {
    onChange(current => [...current, ...list.map(entry => ({ ...entry, activity, clientKey: newKey() }))]);
    setAdded(list.length === 1 ? `Added “${list[0].title || 'your media'}”.` : `Added ${list.length} files.`);
  };

  // Checks size and type before uploading, and discards partial temporary uploads on failure.
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
    const uploaded = [];
    try {
      for (const file of files) uploaded.push({ ...(await uploadFile(file)), pending: true });
      add(uploaded);
      setPanel(null);
    } catch (failure) {
      for (const item of uploaded) discardUpload(item);
      setError(failure.message);
    } finally { setBusy(false); }
  }
  // Changes only the selected attachment in memory and cleans up replaced temporary uploads.
  function change(item, patch) {
    if (patch.replace) {
      discardUpload(item);
      onChange(current => current.map(entry => mediaKey(entry) === mediaKey(item) ? { ...patch.replace, clientKey: newKey(), title: patch.replace.title } : entry));
      return;
    }
    onChange(current => current.map(entry => mediaKey(entry) === mediaKey(item) ? { ...entry, ...patch } : entry));
  }
  // Removes the attachment from the editor and discards only its temporary upload, if any.
  function remove(item) {
    discardUpload(item);
    onChange(current => current.filter(entry => mediaKey(entry) !== mediaKey(item)));
  }
  // Clears stale messages when the coach chooses an attachment method.
  const openPanel = mode => { setPanel(mode); setError(''); setAdded(''); };
  return <div className="media-editor">
    {label && <h4>{label}</h4>}
    {note && <small>{note}</small>}
    {items.length > 0 && <ul className="media-list">{items.map(item => <Attachment key={mediaKey(item)} item={item} headings={headings} disabled={disabled} onChange={patch => change(item, patch)} onRemove={() => remove(item)} />)}</ul>}
    {items.length === 0 && <small>No pictures or videos yet.</small>}
    {added && <p ref={addedRef} className="success media-added" role="status">{added} It is saved with the lesson when you press Save.</p>}
    {!panel && <button type="button" className="secondary add-media" disabled={disabled || full || busy} onClick={() => openPanel('choose')}>{full ? 'Media limit reached' : 'Add Media'}</button>}
    {panel && <div className="media-panel">
      <div className="actions" role="group" aria-label="How to add media">
        <button type="button" className={panel === 'upload' ? '' : 'secondary'} aria-pressed={panel === 'upload'} disabled={busy} onClick={() => openPanel('upload')}>Upload picture or video</button>
        <button type="button" className={panel === 'link' ? '' : 'secondary'} aria-pressed={panel === 'link'} disabled={busy} onClick={() => openPanel('link')}>Paste a link</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => setPanel(null)}>Close</button>
      </div>
      {panel === 'choose' && <small>Choose how to add a picture or video: upload a file from this device, or paste a YouTube or picture link.</small>}
      {panel === 'upload' && <div className="media-panel-body" data-media-pending={busy ? 'true' : undefined}>
        <label>Choose files
          <input form={detached} type="file" accept={accept} multiple disabled={busy} onChange={upload} />
          <small>PNG, JPEG, GIF, WebP pictures up to 6 MB. MP4 or WebM videos up to 20 MB. Longer videos: use a YouTube link.</small>
        </label>
        {busy && <p role="status">Uploading and checking the file…</p>}
      </div>}
      {panel === 'link' && <LinkChecker action={activity ? 'Add to this activity' : 'Add to the whole lesson'} onCancel={() => setPanel(null)} onVerified={info => { add([{ ...info, origin: 'link' }]); setPanel(null); }} />}
      {error && <p className="error" role="alert">{error}</p>}
    </div>}
  </div>;
}
