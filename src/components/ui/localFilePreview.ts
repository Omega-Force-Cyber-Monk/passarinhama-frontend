/** Presentation-only object URLs never replace the File held by a form. */
export function createObjectUrlLease(blob: Blob) {
  const url = URL.createObjectURL(blob);
  let released = false;
  return { url, release() { if (!released) { released = true; URL.revokeObjectURL(url); } } };
}

export function localPreviewMime(file: File): string | null {
  const mime = file.type.toLowerCase();
  // Active HTML/SVG/XML documents must download rather than execute under the app's origin.
  if (mime) return /^(image\/(png|jpeg|gif|webp|avif|bmp)|application\/pdf|text\/plain|audio\/[\w.+-]+|video\/[\w.+-]+)$/.test(mime) ? mime : null;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', txt: 'text/plain' } as Record<string, string>)[extension || ''] || null;
}

export function openLocalFile(file: File) {
  const mime = localPreviewMime(file);
  if (!mime) throw new Error('This file type supports download only');
  const tab = window.open('about:blank', '_blank');
  if (!tab) throw new Error('File tab was blocked');
  tab.opener = null;
  let lease: ReturnType<typeof createObjectUrlLease> | undefined;
  try {
    lease = createObjectUrlLease(file.type ? file : new Blob([file], { type: mime }));
    tab.location.replace(lease.url);
    // This viewer owns its URL independently of the thumbnail/component lifetime.
    window.setTimeout(lease.release, 60_000);
  } catch (error) { lease?.release(); tab.close(); throw error; }
}

export function downloadLocalFile(file: File) {
  const lease = createObjectUrlLease(file);
  const link = document.createElement('a');
  try {
    link.href = lease.url; link.download = file.name;
    document.body.appendChild(link); link.click();
  } finally { link.remove(); window.setTimeout(lease.release, 1000); }
}
