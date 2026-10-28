'use client';

import { useEffect, useRef } from 'react';

/** Paints the static desk, then runs its inline script. innerHTML does not execute scripts. */
export function BiuroFrame({ body, script }: { body: string; script: string }) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !script) return;
    ran.current = true;
    const el = document.createElement('script');
    el.text = script;
    document.body.appendChild(el);
  }, [script]);

  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: body }} />;
}
