import { useState } from "react";

export function StudyRemovalButton({ title, onRemove }: { title: string; onRemove: () => string | null }) {
  const [error, setError] = useState<string | null>(null);
  function remove() {
    if (!window.confirm(`Remove "${title}" and its stored rows from this browser workspace? Studies still used by reports or saved analyses will be kept. This does not delete remote source files or historical snapshot copies. Download a workspace backup first if you may need these rows again.`)) return;
    try { setError(onRemove()); }
    catch { setError("This study could not be removed. Its data has been kept."); }
  }
  return <span className="study-removal-action">
    <button type="button" className="library-row-icon-action danger" aria-label={`Remove ${title}`} onClick={remove}>Remove</button>
    {error && <span role="alert" className="study-removal-error">{error}</span>}
  </span>;
}
