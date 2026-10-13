import test from 'node:test';
import assert from 'node:assert/strict';
import { weekKey, progressExercise, buildPlan, encode, decode, run } from '../scripts/weekly-progression.mjs';

const routine = (id, data) => ({
  name: `projects/asesoriasjessi/databases/(default)/documents/rutinas/${id}`,
  updateTime: '2026-10-13T00:00:00Z', fields: encode(data).mapValue.fields,
});
const exercise = { nombre: 'Ejercicio', unidadPeso: 'KG', solicitarVideo: true, series: [{ peso: '55', reps: '10' }, { peso: '55', reps: '12' }] };

test('usa semanas ISO y fechas de Tijuana, incluso cerca de medianoche', () => {
  assert.equal(weekKey(new Date('2026-10-19T06:59:00Z')), '2026-W42');
  assert.equal(weekKey(new Date('2026-10-19T07:00:00Z')), '2026-W43');
  assert.equal(weekKey(new Date('2027-01-01T20:00:00Z')), '2026-W53');
});

test('aplica la regla vigente preservando series, unidades y solicitudes de video', () => {
  const result = progressExercise(exercise);
  assert.deepEqual(result.exercise.series, [{ peso: '55', reps: '11' }, { peso: '60', reps: '8' }]);
  assert.equal(result.exercise.solicitarVideo, true);
  assert.equal(result.exercise.series.length, 2);
  assert.equal(result.exercise.unidadPeso, 'KG');
  assert.equal(result.changes.length, 2);
  assert.equal(exercise.series[0].reps, '10');
});

test('respeta KG y LB y no adivina unidades ni transforma prescripciones no numéricas', () => {
  assert.equal(progressExercise({ unidadPeso: 'LB', series: [{ peso: '50', reps: '12' }] }).exercise.series[0].peso, '60');
  const custom = { series: [{ peso: '50', reps: '12' }, { peso: '10', reps: 'fallo' }, { peso: '', reps: '30 s' }] };
  assert.deepEqual(progressExercise(custom).exercise, custom);
});

test('mantiene el reinicio a 8 de la regla anterior al superar 12', () => {
  assert.deepEqual(progressExercise({ unidadPeso: 'LB', series: [{ peso: '15', reps: '20' }] }).exercise.series[0], { peso: '25', reps: '8' });
});

test('solo avanza una vez aunque falten varias semanas y una reejecución no duplica', () => {
  const data = { progWeek: '2026-W40', ejercicios: [exercise] };
  const plan = buildPlan([routine('lun', data)], null, '2026-W42');
  assert.equal(plan.updates[0].patch.ejercicios[0].series[0].reps, '11');
  assert.equal(buildPlan([routine('lun', { ...data, ...plan.updates[0].patch })], null, '2026-W42').updates.length, 0);
});

test('protege semanas iniciadas y solo las modifica con autorización explícita', () => {
  const docs = [routine('lun', { progWeek: '2026-W40', ejercicios: [exercise] })];
  const progress = routine('week', { exDone: ['lun#0#0'] });
  assert.equal(buildPlan(docs, progress, '2026-W42').updates[0].reason, 'semana_iniciada');
  assert.equal(buildPlan(docs, progress, '2026-W42', 'weekly', true).updates[0].changes.length, 2);
});

test('respeta descargas, pausas, rutinas archivadas y línea base sin aumentar cargas', () => {
  const docs = [routine('deload', { progWeek: '2026-W40', deloadActive: true, ejercicios: [exercise] }),
    routine('old', { archivada: true, ejercicios: [exercise] })];
  const plan = buildPlan(docs, null, '2026-W42');
  assert.equal(plan.updates.length, 1);
  assert.deepEqual(plan.updates[0].patch, { progWeek: '2026-W42' });
  assert.deepEqual(buildPlan([routine('base', { ejercicios: [exercise] })], null, '2026-W42').updates[0].patch, { progWeek: '2026-W42' });
});

test('codificación Firestore conserva valores cero, false, series y metadatos', () => {
  const value = { cero: 0, pausa: false, fields: [exercise], vacio: null };
  assert.deepEqual(decode(encode(value)), value);
});

test('simular no escribe y un conflicto cancela el commit completo', async () => {
  const docs = [routine('lun', { progWeek: '2026-W40', ejercicios: [exercise] })];
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (options.method === 'POST') return { ok: false, status: 409 };
    if (url.pathname.endsWith('/rutinas')) return { ok: true, json: async () => ({ documents: docs }) };
    return { ok: false, status: 404 };
  };
  const args = { apiKey: 'fixture', now: new Date('2026-10-13T20:00:00Z'), fetchImpl };
  assert.equal((await run(args)).changedSeries, 2);
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 0);
  await assert.rejects(run({ ...args, apply: true }), /Commit cancelado/);
  const writes = JSON.parse(calls.find(call => call.options.method === 'POST').options.body).writes;
  assert.equal(writes.length, 2);
  assert.ok(writes[0].currentDocument.updateTime);
  assert.deepEqual(writes[1].currentDocument, { exists: false });
  assert.deepEqual(writes[1].updateMask.fieldPaths, ['progression']);
});
