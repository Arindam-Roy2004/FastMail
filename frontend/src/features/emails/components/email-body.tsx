import DOMPurify from 'dompurify';
import { useMemo } from 'react';

// Links in a rendered email always open outside the dashboard.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function EmailBody({ html }: { html: string }) {
  const clean = useMemo(() => DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }), [html]);
  return <div className="email-content max-w-[740px] break-words" dangerouslySetInnerHTML={{ __html: clean }} />;
}
