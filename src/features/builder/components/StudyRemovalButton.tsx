import { useEffect, useRef, useState } from "react";

export function StudyRemovalButton({ title, onRemove }: { title: string; onRemove: () => string | null | Promise<string | null> }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function remove() {
    if (busy.current) return;
    if (!window.confirm(`Remove "${title}" and its stored rows from this browser workspace? Studies still used by reports or saved analyses will be kept. This does not delete remote source files or historical snapshot copies. Download a workspace backup first if you may need these rows again.`)) return;
    busy.current = true; setPending(true); setError(null);
    try { const result = await onRemove(); if (active.current) setError(result); }
    catch { if (active.current) setError("This study could not be removed. Its data has been kept."); }
    finally { busy.current = false; if (active.current) setPending(false); }
  }
  return <span className="study-removal-action">
    <button type="button" className="library-row-icon-action danger" aria-label={`Remove ${title}`} disabled={pending} onClick={remove}>Remove</button>
    {error && <span role="alert" className="study-removal-error">{error}</span>}
  </span>;
}
