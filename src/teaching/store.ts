import { db } from '../db';
import { emptyTeaching, validateTeaching, mergeTeaching } from './model.mjs';
import type { TeachingState, Material } from './types';
export async function readTeaching(): Promise<TeachingState> { return validateTeaching((await db.teachingState.get('main'))?.state || emptyTeaching()); }
export async function changeTeaching(change: (s: TeachingState) => TeachingState): Promise<TeachingState> { return db.transaction('rw', db.teachingState, async () => { const state = validateTeaching(change(await readTeaching())); await db.teachingState.put({ id: 'main', state, updatedAt: Date.now() }); return state; }); }
export async function saveMaterial(material: Material, file: File) { return db.transaction('rw', [db.teachingState, db.teachingFiles], async () => { const state = await changeTeaching(s => ({ ...s, materials: [...s.materials, material] })); await db.teachingFiles.put({ id: material.id, name: file.name, blob: file }); return state; }); }
export async function restoreTeaching(backup: {
    state: TeachingState;
    files: {
        id: string;
        name: string;
        dataURL: string;
    }[];
}) {
    const state = mergeTeaching(await readTeaching(), backup.state);
    await db.teachingState.put({ id: 'main', state, updatedAt: Date.now() });
    for (const f of backup.files) {
        const raw = atob(f.dataURL.split(',')[1]);
        const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
        await db.teachingFiles.put({ id: f.id, name: f.name, blob: new Blob([bytes], { type: 'application/pdf' }) });
    }
}
export async function blobDataURL(blob: Blob): Promise<string> { const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = ''; for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768)); return 'data:application/pdf;base64,' + btoa(binary); }
