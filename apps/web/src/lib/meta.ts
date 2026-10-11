const set = (selector: string, attr: string, value: string) => {
  document.head.querySelector(selector)?.setAttribute(attr, value);
};

/** Sets the page title, description and social tags; returns a function that restores the defaults. */
export function setPageMeta(title: string, description: string): () => void {
  const prev = { title: document.title, description: document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? '' };
  const apply = (t: string, d: string) => {
    document.title = t;
    set('meta[name="description"]', 'content', d);
    set('meta[property="og:title"]', 'content', t);
    set('meta[property="og:description"]', 'content', d);
  };
  apply(title, description);
  return () => apply(prev.title || 'Arcade Hub', prev.description);
}
