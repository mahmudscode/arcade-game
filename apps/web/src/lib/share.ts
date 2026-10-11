/** Shares a link with the native share sheet when there is one, otherwise copies it. True when something was shared or copied. */
export async function shareLink(data: { title: string; text: string; url: string }): Promise<boolean> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share(data);
      return true;
    }
  } catch (e) {
    // Dismissing the sheet is not an error; any other failure falls back to copying.
    if (e instanceof DOMException && e.name === 'AbortError') return false;
  }
  try {
    await navigator.clipboard.writeText(`${data.text} ${data.url}`);
    return true;
  } catch {
    return false;
  }
}
