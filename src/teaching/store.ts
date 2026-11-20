import {teachingMime} from './files.mjs';
import { db } from '../db';
import { emptyTeaching, validateTeaching, mergeTeaching } from './model.mjs';
import {purgeTeachingTrash} from './trash-model.mjs';
import type { TeachingState, Material } from './types';
export async function readTeaching(): Promise<TeachingState> { return validateTeaching((await db.teachingState.get('main'))?.state || emptyTeaching()); }
export async function changeTeaching(change: (s: TeachingState) => TeachingState): Promise<TeachingState> { return db.transaction('rw', db.teachingState, async () => { const state = validateTeaching(change(await readTeaching())); await db.teachingState.put({ id: 'main', state, updatedAt: Date.now() }); return state; }); }
export async function emptyTeachingTrash(expectedToken:string):Promise<TeachingState>{
  return db.transaction('rw',[db.teachingState,db.teachingFiles],async()=>{
    const result=purgeTeachingTrash(await readTeaching(),expectedToken);
    await db.teachingState.put({id:'main',state:result.state,updatedAt:Date.now()});
    await db.teachingFiles.bulkDelete(result.fileIds);
    return result.state;
  });
}
export async function replaceTeachingFile(id:string,file:File,fingerprint:string){
  return db.transaction('rw',[db.teachingState,db.teachingFiles],async()=>{
    const state=await readTeaching(),material=state.materials.find(m=>m.id===id);
    if(!material||material.deletedAt)throw Error('资料已删除，请先恢复后再补回原文件');
    if(material.fingerprint!==fingerprint)throw Error('资料已发生变化，请重新选择原文件');
    await db.teachingFiles.put({id,name:file.name,blob:new Blob([file],{type:teachingMime[material.format||'pdf']})});
  });
}
export async function saveMaterial(material: Material, file: File) { return db.transaction('rw', [db.teachingState, db.teachingFiles], async () => { const state = await changeTeaching(s => {if(material.role!=='primary'&&!s.materials.some(m=>m.id===material.primaryId&&!m.deletedAt))throw Error('主教材已删除，请先恢复或重新选择');return { ...s, materials: [...s.materials, material] };}); await db.teachingFiles.put({ id: material.id, name: file.name, blob: new Blob([file],{type:teachingMime[material.format||'pdf']}) }); return state; }); }
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
        await db.teachingFiles.put({ id: f.id, name: f.name, blob: new Blob([bytes], { type: f.dataURL.slice(5,f.dataURL.indexOf(';')) }) });
    }
}
export async function blobDataURL(blob: Blob): Promise<string> { const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = ''; for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768)); return 'data:'+(blob.type||'application/pdf')+';base64,'+btoa(binary); }
