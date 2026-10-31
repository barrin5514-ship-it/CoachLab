// Lists imported research posts privately and turns one into a saved lesson.
import React, { useEffect, useState } from 'react';
export default function ResearchLibrary({ onBuilt }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  async function load() { setLoading(true); setError(''); try { const r = await fetch('/api/research-posts'); if (!r.ok) throw new Error('Unable to load the library.'); setPosts(await r.json()); } catch { setError('Could not load your research library.'); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  async function build(post) { setBusy(post.id); try { const r = await fetch('/api/lessons/from-post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: post.id }) }); if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Could not build the lesson.'); } onBuilt && onBuilt(); } catch (e) { setError(e.message); } finally { setBusy(null); } }
  if (loading) return <p role="status">Loading your research library...</p>;
  if (error && !posts.length) return <div className="error" role="alert"><p>{error}</p><button className="secondary" onClick={load}>Retry</button></div>;
  if (!posts.length) return <section><h2>Research Library</h2><p>No posts sent yet. Use the Research Agent to send analyzed posts here.</p></section>;
  return (
    <section aria-labelledby="research-library-heading">
      <div className="section-heading"><h2 id="research-library-heading">Research Library</h2><span>{posts.length} imported post{posts.length === 1 ? '' : 's'}</span></div>
      {error && <div className="error" role="alert"><p>{error}</p></div>}
      <div className="lesson-grid">
        {posts.map(post => (
          <article key={post.id} className="lesson-card">
            <h3>{post.title}</h3>
            {post.discipline && <p className="meta">Discipline: {post.discipline}</p>}
            {post.drills && <p>Drills: {post.drills}</p>}
            {post.summary && <p>{post.summary}</p>}
            <a href={post.url} target="_blank" rel="noopener noreferrer">Open post</a>
            <button className="secondary" disabled={busy === post.id} onClick={() => build(post)}>{busy === post.id ? 'Building...' : 'Build a lesson from this post'}</button>
          </article>
        ))}
      </div>
    </section>
  );
}
