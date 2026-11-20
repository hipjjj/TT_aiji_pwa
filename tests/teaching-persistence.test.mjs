import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { validateTeachingBackup, generatePlan } from '../src/teaching/model.mjs';
import { fixture } from './helpers/teaching-fixture.mjs';
import {deleteMaterial,teachingTrashSummary} from '../src/teaching/trash-model.mjs';
test('teaching data survives reload and concurrent changes; original PDF is included only when selected', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'tt-teaching-'));
    const result = await build({ stdin: { contents: "export {db} from './src/db.ts';export {changeTeaching,readTeaching,saveMaterial,restoreTeaching,emptyTeachingTrash} from './src/teaching/store.ts';export {createBackup} from './src/backup/export.ts';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{ name: 'shared-dexie', setup(b) { b.onResolve({ filter: /^dexie$/ }, () => ({ path: pathToFileURL(join(process.cwd(), 'node_modules/dexie/dist/dexie.mjs')).href, external: true })); } }] });
    const modulePath = join(folder, 'app.mjs');
    writeFileSync(modulePath, result.outputFiles[0].text);
    const { db, changeTeaching, readTeaching, saveMaterial, restoreTeaching, emptyTeachingTrash, createBackup } = await import(pathToFileURL(modulePath).href);
    await db.delete();
    await db.open();
    const state = fixture(), blob = new File(['%PDF-1.4\noriginal bytes'], 'book.pdf', { type: 'application/pdf' });
    try {
        await saveMaterial(state.materials[0], blob);
        await changeTeaching(s => ({ ...s, terms: state.terms, classes: state.classes }));
        await Promise.all([changeTeaching(s => ({ ...s, classes: s.classes.map(c => ({ ...c, name: '八一修改' })) })), changeTeaching(s => ({ ...s, plans: [...s.plans, generatePlan(s, s.classes[0])] }))]);
        db.close();
        await db.open();
        const restored = await readTeaching();
        assert.equal(restored.classes[0].name, '八一修改');
        assert.equal(restored.plans.length, 1);
        const light = await createBackup('teaching', false, null, false);
        assert.equal(light.teaching.state.classes.length, 1);
        assert.deepEqual(light.teaching.files, []);
        assert.equal(light.teaching.filesIncluded, false);
        validateTeachingBackup(light);
        const full = await createBackup('teaching', false, null, true);
        assert.equal(full.teaching.files.length, 1);
        assert.equal(full.teaching.files[0].dataURL, 'data:application/pdf;base64,' + Buffer.from(await blob.arrayBuffer()).toString('base64'));
        validateTeachingBackup(full);
        await db.teachingState.clear();
        await db.teachingFiles.clear();
        await db.transaction('rw', [db.teachingState, db.teachingFiles], () => restoreTeaching(full.teaching));
        assert.equal((await readTeaching()).classes[0].name, '八一修改');
        assert.equal(await (await db.teachingFiles.get('book')).blob.text(), await blob.text());
        await db.transaction('rw', [db.teachingState, db.teachingFiles], () => restoreTeaching(light.teaching));
        assert.equal(await (await db.teachingFiles.get('book')).blob.text(), await blob.text());
        assert.equal(await db.expenses.count(), 0);
        const expense={id:'unrelated',date:'2026-11-20',category:'餐饮',cents:100,note:'原账单',photo:'original-photo-bytes'};
        await db.expenses.put(expense);
        const deleted=await changeTeaching(s=>deleteMaterial(s,'book')),token=teachingTrashSummary(deleted).token;
        assert.ok(await db.teachingFiles.get('book'));
        await assert.rejects(emptyTeachingTrash('stale-confirmation'),/重新查看/);
        assert.deepEqual(await readTeaching(),deleted);
        const failDelete=()=>{throw Error('simulated file deletion failure');};db.teachingFiles.hook('deleting',failDelete);
        await assert.rejects(emptyTeachingTrash(token),/simulated/);
        assert.deepEqual(await readTeaching(),deleted);assert.ok(await db.teachingFiles.get('book'));
        db.teachingFiles.hook('deleting').unsubscribe(failDelete);
        const cleared=await emptyTeachingTrash(token);
        assert.equal(cleared.materials.length,0);assert.equal(cleared.classes.length,0);assert.equal(cleared.plans.length,0);
        assert.equal(await db.teachingFiles.get('book'),undefined);assert.deepEqual(await db.expenses.get('unrelated'),expense);

    }
    finally {
        await db.delete();
        rmSync(folder, { recursive: true, force: true });
    }
});
