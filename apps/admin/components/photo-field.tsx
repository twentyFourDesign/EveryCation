'use client';
import { useState } from 'react';
import { errorMessage, uploadPhoto } from '@/lib/api';

/** Shows the current photo and lets staff replace it. Uploads as soon as a file is chosen. */
export function PhotoField({ folder, value, onChange }: { folder: 'products' | 'places'; value: string | null; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- uploaded photos come from the API's media host */}
      {value ? <img src={value} alt="" className="size-16 rounded-xl object-cover" /> : <span className="grid size-16 place-items-center rounded-xl bg-surface-muted text-xs text-ink-muted">No photo</span>}
      <label className="flex flex-col gap-1 text-[13px] font-semibold">Photo
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="text-xs font-normal"
          onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); setError(''); try { onChange(await uploadPhoto(folder, f)); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } }} />
        <span className="text-xs font-normal text-ink-muted">{busy ? 'Uploading…' : error || 'JPEG, PNG or WebP, up to 8 MB'}</span>
      </label>
    </div>
  );
}
