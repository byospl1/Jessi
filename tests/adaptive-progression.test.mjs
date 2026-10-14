import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdaptiveDraft, generateDraft, reviewDraft, shiftWeek } from '../scripts/adaptive-progression.mjs';
import { encode, decodeFields } from '../scripts/weekly-progression.mjs';

const sourceWeek = '2026-W42';
const targetWeek = '2026-W43';
const monday = new Date('2026-10-19T18:00:00Z');
const wednesday = new Date('2026-10-14T18:00:00Z');
const path = collection => `projects/asesoriasjessi/databases/(default)/documents/${collection}`;
const doc = (collection, value, version = '2026-10-14T00:00:00Z') => ({
  name: path(collection), updateTime: version, fields: encode(value).mapValue.fields,
});
const exercise = (overrides = {}) => ({ nombre: 'Predicador en banco', unidadPeso: 'LB',
  series: [{ peso: '40', reps: '8' }, { peso: '40', reps: '8' }], ...overrides });
const routine = (ex = exercise(), overrides = {}) => doc('rutinas/mie', {
  nombre: 'Miércoles', progWeek: sourceWeek, ejercicios: [ex], ...overrides,
});
const feedback = (overrides = {}) => ({ schemaVersion: 1, dayId: 'mie', exerciseIndex: 0,
  exerciseName: 'Predicador en banco', sets: [
    { peso: '40', unidadPeso: 'LB', reps: '8' }, { peso: '40', unidadPeso: 'LB', reps: '8' },
  ], rir: '2', difficulty: 'adecuada', recovery: 'buena', pump: 'medio',
  soreness: false, discomfort: false, ...overrides,
});
const progress = (fb = feedback(), overrides = {}) => doc(`progreso/${sourceWeek}`, {
  doneIds: ['mie'], exDone: ['mie#0#0', 'mie#0#1'], exerciseFeedback_mie_0: fb, ...overrides,
});

test('desplaza semanas ISO sin depender del horario de verano de Tijuana', () => {
  assert.equal(shiftWeek('2026-W42', 1), '2026-W43');
  assert.equal(shiftWeek('2026-W01', -1), '2025-W52');
  assert.equal(shiftWeek('2026-W53', 1), '2027-W1');
});

test('propone +1 repetición solo con día cerrado, series reales y feedback suficiente', () => {
  const draft = buildAdaptiveDraft([routine()], progress(), null, sourceWeek, wednesday);
  assert.equal(draft.state, 'pending');
  assert.equal(draft.targetWeek, targetWeek);
  assert.equal(draft.summary.candidates, 1);
  assert.equal(draft.items[0].action, 'increase_reps');
  assert.deepEqual(draft.items[0].changes.map(c => c.after.reps), ['9', '9']);
  assert.equal(buildAdaptiveDraft([routine()], progress(null, { doneIds: [] }), null, sourceWeek).summary.candidates, 0);
  assert.equal(buildAdaptiveDraft([routine()], progress(null, { exDone: ['mie#0#0'] }), null, sourceWeek).summary.candidates, 0);
  assert.equal(buildAdaptiveDraft([routine()], progress(null, { exerciseFeedback_mie_0: null }), null, sourceWeek).summary.candidates, 0);
});

test('retiene aumentos ante RIR bajo, recuperación parcial, molestias o carga no comparable', () => {
  for (const changed of [
    { rir: '0' }, { rir: 'no_se' }, { recovery: 'parcial' }, { recovery: 'insuficiente' },
    { difficulty: 'muy_dificil' }, { discomfort: true }, { soreness: true },
    { sets: [{ peso: '40', unidadPeso: 'KG', reps: '8' }, { peso: '40', unidadPeso: 'LB', reps: '8' }] },
    { sets: [{ peso: '40', unidadPeso: 'LB', reps: '7' }, { peso: '40', unidadPeso: 'LB', reps: '8' }] },
  ]) {
    const item = buildAdaptiveDraft([routine()], progress(feedback(changed)), null, sourceWeek).items[0];
    assert.equal(item.changes.length, 0, JSON.stringify(changed));
  }
});

test('no inventa saltos de carga: requiere dos exposiciones comparables y configuración', () => {
  const ex = exercise({ series: [{ peso: '40', reps: '12' }, { peso: '40', reps: '12' }] });
  const fb = feedback({ sets: [
    { peso: '40', unidadPeso: 'LB', reps: '12' }, { peso: '40', unidadPeso: 'LB', reps: '12' },
  ] });
  assert.equal(buildAdaptiveDraft([routine(ex)], progress(fb), null, sourceWeek).items[0].action, 'hold');
  const prior = doc('progreso/2026-W41', {
    doneIds: ['mie'], exDone: ['mie#0#0', 'mie#0#1'], exerciseFeedback_mie_0: fb,
  });
  assert.equal(buildAdaptiveDraft([routine(ex)], progress(fb), prior, sourceWeek).items[0].action, 'review');
  const configured = exercise({ ...ex, progressionConfig: { loadStep: 2, loadStepUnit: 'LB' } });
  const item = buildAdaptiveDraft([routine(configured)], progress(fb), prior, sourceWeek).items[0];
  assert.equal(item.action, 'increase_load');
  assert.deepEqual(item.changes.map(c => c.after), [{ peso: '42', reps: '8' }, { peso: '42', reps: '8' }]);
  const tooLarge = exercise({ ...ex, progressionConfig: { loadStep: 10, loadStepUnit: 'LB' } });
  assert.equal(buildAdaptiveDraft([routine(tooLarge)], progress(fb), prior, sourceWeek).items[0].action, 'review');
});

function fakeFirestore(initial = {}) {
  const docs = new Map(Object.entries(initial));
  const calls = [];
  let commits = 0;
  const fetchImpl = async (url, options = {}) => {
    const href = String(url);
    calls.push({ href, options });
    if (options.method === 'POST') {
      commits++;
      const writes = JSON.parse(options.body).writes;
      for (const write of writes) {
        const old = docs.get(write.update.name);
        if (write.currentDocument?.exists === false && old) return { ok: false, status: 409 };
        if (write.currentDocument?.updateTime && old?.updateTime !== write.currentDocument.updateTime) return { ok: false, status: 409 };
      }
      for (const write of writes) {
        const old = docs.get(write.update.name);
        const oldData = decodeFields(old?.fields);
        const patchData = decodeFields(write.update.fields);
        docs.set(write.update.name, doc(write.update.name.split('/documents/')[1], { ...oldData, ...patchData },
          `2026-10-14T00:00:${String(commits).padStart(2, '0')}Z`));
      }
      return { ok: true, json: async () => ({}) };
    }
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/rutinas')) return { ok: true, json: async () => ({
      documents: [...docs.values()].filter(value => value.name.includes('/rutinas/')),
    }) };
    const current = docs.get(pathname.replace(/^\/v1\//, ''));
    return current ? { ok: true, json: async () => current } : { ok: false, status: 404 };
  };
  return { docs, calls, fetchImpl, get commits() { return commits; } };
}

test('genera borrador idempotente con precondición de Firestore, sin tocar rutinas', async () => {
  const db = fakeFirestore({ [path('rutinas/mie')]: routine(), [path(`progreso/${sourceWeek}`)]: progress() });
  const first = await generateDraft({ apiKey: 'fixture', now: wednesday, fetchImpl: db.fetchImpl });
  assert.equal(first.verified, true);
  assert.equal(first.summary.candidates, 1);
  assert.equal(db.commits, 1);
  const writes = JSON.parse(db.calls.find(call => call.options.method === 'POST').options.body).writes;
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].currentDocument, { exists: false });
  assert.equal(decodeFields(db.docs.get(path('rutinas/mie')).fields).ejercicios[0].series[0].reps, '8');
  const second = await generateDraft({ apiKey: 'fixture', now: wednesday, fetchImpl: db.fetchImpl });
  assert.equal(second.unchanged, true);
  assert.equal(db.commits, 1);
});

test('no aplica sin selección, técnica revisada o con semana de origen abierta', async () => {
  const db = fakeFirestore({ [path('rutinas/mie')]: routine(), [path(`progreso/${sourceWeek}`)]: progress(null, { doneIds: [] }) });
  const draft = await generateDraft({ apiKey: 'fixture', now: wednesday, fetchImpl: db.fetchImpl });
  const base = { apiKey: 'fixture', now: wednesday, targetWeek, draftId: draft.id,
    decision: 'approve', reviewer: 'byospl1', fetchImpl: db.fetchImpl };
  await assert.rejects(reviewDraft({ ...base, now: monday }), /técnica revisada/);
  await assert.rejects(reviewDraft({ ...base, techniqueConfirmed: true, approvedExercises: ['mie#0'] }), /semana de origen sigue abierta/);
  assert.equal(db.commits, 1);
});

test('un día marcado como terminado pero con series incompletas no adelanta la rutina', async () => {
  const incomplete = progress(null, { exDone: ['mie#0#0'] });
  const db = fakeFirestore({ [path('rutinas/mie')]: routine(), [path(`progreso/${sourceWeek}`)]: incomplete });
  const draft = await generateDraft({ apiKey: 'fixture', now: wednesday, fetchImpl: db.fetchImpl });
  await assert.rejects(reviewDraft({ apiKey: 'fixture', now: wednesday, targetWeek, draftId: draft.id,
    decision: 'approve', reviewer: 'byospl1', techniqueConfirmed: true,
    approvedExercises: ['mie#0'], fetchImpl: db.fetchImpl }), /semana de origen sigue abierta/);
  assert.equal(db.commits, 1);
});

test('aprueba solo ejercicios seleccionados con commit atómico y rechaza borrador obsoleto', async () => {
  const db = fakeFirestore({ [path('rutinas/mie')]: routine(), [path(`progreso/${sourceWeek}`)]: progress() });
  const draft = await generateDraft({ apiKey: 'fixture', now: wednesday, fetchImpl: db.fetchImpl });
  const base = { apiKey: 'fixture', now: monday, targetWeek, draftId: draft.id,
    decision: 'approve', reviewer: 'byospl1', techniqueConfirmed: true,
    approvedExercises: ['mie#0'], fetchImpl: db.fetchImpl };
  await assert.rejects(reviewDraft({ ...base, draftId: 'otro' }), /Borrador vencido/);
  const result = await reviewDraft(base);
  assert.equal(result.verified, true);
  assert.equal(result.changedSeries, 2);
  assert.equal(db.commits, 2);
  const saved = decodeFields(db.docs.get(path('rutinas/mie')).fields);
  assert.equal(saved.progWeek, targetWeek);
  assert.deepEqual(saved.ejercicios[0].series.map(serie => serie.reps), ['9', '9']);
  const audit = decodeFields(db.docs.get(path(`progreso/${targetWeek}`)).fields);
  assert.equal(audit.adaptiveDraft.state, 'applied');
  assert.deepEqual(audit.adaptiveDecision.approvedExercises, ['mie#0']);
  await assert.rejects(reviewDraft(base), /ya actualizada/);
});

test('no aplica si la semana destino ya tiene actividad', async () => {
  const db = fakeFirestore({ [path('rutinas/mie')]: routine(), [path(`progreso/${sourceWeek}`)]: progress() });
  const draft = await generateDraft({ apiKey: 'fixture', now: wednesday, fetchImpl: db.fetchImpl });
  const targetDoc = db.docs.get(path(`progreso/${targetWeek}`));
  const data = decodeFields(targetDoc.fields);
  db.docs.set(targetDoc.name, doc(`progreso/${targetWeek}`, { ...data, exDone: ['mie#0#0'] }, targetDoc.updateTime));
  await assert.rejects(reviewDraft({ apiKey: 'fixture', now: monday, targetWeek, draftId: draft.id,
    decision: 'approve', reviewer: 'byospl1', techniqueConfirmed: true, approvedExercises: ['mie#0'],
    fetchImpl: db.fetchImpl }), /Semana destino iniciada/);
  assert.equal(db.commits, 1);
});

test('rechazo no modifica rutinas ni reaparece sin datos nuevos; un input nuevo crea otro borrador', async () => {
  const db = fakeFirestore({ [path('rutinas/mie')]: routine(), [path(`progreso/${sourceWeek}`)]: progress() });
  const first = await generateDraft({ apiKey: 'fixture', now: wednesday, fetchImpl: db.fetchImpl });
  const result = await reviewDraft({ apiKey: 'fixture', now: wednesday, targetWeek, draftId: first.id,
    decision: 'reject', reviewer: 'byospl1', fetchImpl: db.fetchImpl });
  assert.equal(result.verified, true);
  assert.equal(decodeFields(db.docs.get(path('rutinas/mie')).fields).progWeek, sourceWeek);
  const repeated = await generateDraft({ apiKey: 'fixture', now: wednesday, fetchImpl: db.fetchImpl });
  assert.match(repeated.skipped, /rechazado/);
  const revised = progress(feedback({ rir: '3' }), {}, '2026-10-14T00:01:00Z');
  db.docs.set(path(`progreso/${sourceWeek}`), revised);
  const next = await generateDraft({ apiKey: 'fixture', now: wednesday, fetchImpl: db.fetchImpl });
  assert.notEqual(next.id, first.id);
  const stored = decodeFields(db.docs.get(path(`progreso/${targetWeek}`)).fields);
  assert.equal(stored.adaptiveDraft.state, 'pending');
  assert.equal(stored.adaptiveDraftHistory.at(-1).id, first.id);
});

test('una edición concurrente del input invalida la aprobación anterior', async () => {
  const db = fakeFirestore({ [path('rutinas/mie')]: routine(), [path(`progreso/${sourceWeek}`)]: progress() });
  const draft = await generateDraft({ apiKey: 'fixture', now: wednesday, fetchImpl: db.fetchImpl });
  db.docs.set(path(`progreso/${sourceWeek}`), progress(feedback({ recovery: 'parcial' }), {}, '2026-10-14T00:01:00Z'));
  await assert.rejects(reviewDraft({ apiKey: 'fixture', now: monday, targetWeek, draftId: draft.id,
    decision: 'approve', reviewer: 'byospl1', techniqueConfirmed: true,
    approvedExercises: ['mie#0'], fetchImpl: db.fetchImpl }), /Borrador vencido/);
  assert.equal(db.commits, 1);
});
