// Keeps full coaching safety content available in a keyboard-accessible disclosure.
import React from 'react';
// Editors start expanded so review content is visible before saving; saved cards may start closed.
export default function SafetyNotes({ children, expanded = false }) {
  return <details className="safety-notes" open={expanded}><summary>Show safety notes</summary><div>{children}</div></details>;
}
