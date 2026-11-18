import { useEffect, useRef } from 'react';

const isTyping = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

type Options = {
  allowInInputs?: boolean;
  meta?: boolean;
  enabled?: boolean;
};

export function useHotkey(key: string, handler: (event: KeyboardEvent) => void, options: Options = {}) {
  const { allowInInputs = false, meta = false, enabled = true } = options;
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      const hasMeta = event.metaKey || event.ctrlKey;
      if (meta !== hasMeta || event.altKey) return;
      if (!allowInInputs && isTyping(event.target)) return;
      // An open menu or dialog owns Escape.
      if (key === 'Escape' && document.querySelector('[role="dialog"], [role="menu"]')) return;
      event.preventDefault();
      handlerRef.current(event);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, allowInInputs, meta, enabled]);
}
