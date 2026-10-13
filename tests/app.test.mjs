import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/app.html'), 'utf8');
const script = source.match(/<script type="text\/x-dc"[\s\S]*?>([\s\S]*?)<\/script>/);
assert.ok(script, 'el componente debe existir en la fuente');
const memory = new Map();
const localStorage = {
  get length() { return memory.size; },
  key(i) { return [...memory.keys()][i] || null; },
  getItem(k) { return memory.get(k) ?? null; },
  setItem(k, v) { memory.set(k, String(v)); },
  removeItem(k) { memory.delete(k); }
};
const context = vm.createContext({
  localStorage,
  console: { error() {}, warn() {}, log() {} },
  DCLogic: class { setState(patch) { this.state = { ...this.state, ...patch }; } }
});
vm.runInContext(script[1] + '\nglobalThis.JessiComponent = Component;', context);
const makeApp = () => new context.JessiComponent();

test('el historial muestra semanas sin documento sin contarlas como cero', () => {
  memory.clear();
  const app = makeApp();
  app.weekKey = () => '2026-W40';
  app.state.rutinas = [{ _id: 'lun' }, { _id: 'mie' }, { _id: 'vie' }, { _id: 'sab' }];
  app._progDocs = {
    '2026-W37': { doneIds: ['lun', 'mie'], exDone: [] },
    '2026-W39': { doneIds: ['lun'], plannedDayIds: ['lun', 'mie', 'vie', 'sab'], exDone: [] }
  };
  const weeks = app.getHistory();
  assert.equal(weeks.length, 3);
  assert.equal(weeks.find(w => w.wk === '2026-W38').status, 'SIN REGISTRO');
  assert.equal(weeks.find(w => w.wk === '2026-W38').ganadas, '—');
  assert.equal(weeks.find(w => w.wk === '2026-W37').estimatedTotal, true);
  assert.equal(weeks.find(w => w.wk === '2026-W39').estimatedTotal, false);
});

test('el gráfico convierte LB a KG y excluye valores sin unidad', () => {
  const app = makeApp();
  app._progDocs = {
    '2026-W37': { snapshots: { 'Lunes#Hip Thrust': { unidadPeso: 'KG', series: [{ peso: '55', reps: '8' }] } } },
    '2026-W38': { snapshots: { 'Lunes#Hip Thrust': { unidadPeso: 'LB', series: [{ peso: '121.25', reps: '8' }] } } },
    '2026-W39': { snapshots: { 'Lunes#Hip Thrust': { series: [{ peso: '60', reps: '8' }] } } }
  };
  const chart = app.buildVolumeChart();
  assert.equal(chart.hasVolume, true);
  assert.equal(chart.dots.length, 2);
  assert.match(chart.yMaxLabel, /kg$/);
  assert.match(chart.chartNote, /se excluyen 1 cargas/);
  assert.match(chart.dots[1].ariaLabel, /121.25 LB/);
});

test('marcar una serie nueva no copia el objetivo como resultado real', () => {
  const app = makeApp();
  app.weekKey = () => '2026-W40';
  app.state.rutinas = [{ _id: 'lun', nombre: 'Lunes' }];
  app.state.selected = 0;
  app.state.view = 'detail';
  app.state.detailEx = [{ nombre: 'Hip Thrust', unidadPeso: 'KG', series: [{ peso: '55', reps: '9' }] }];
  const log = app.captureSession('lun', ['lun'], ['lun#0#0'], false, '0#0');
  assert.equal(log.series.length, 1);
  assert.equal(log.series[0].peso, '');
  assert.equal(log.series[0].reps, '');
  assert.equal(log.series[0].unidadPeso, '');
  assert.equal(log.series[0].source, 'not_recorded');
  assert.ok(log.series[0].recordedAt > 0);
  assert.ok(log.completedAt > 0);
});

test('el resultado explícito se guarda por ejercicio sin editar la rutina', async () => {
  memory.clear();
  const app = makeApp();
  app.weekKey = () => '2026-W42';
  app.state.rutinas = [{ _id: 'mie', nombre: 'Miércoles' }];
  app.state.selected = 0;
  app.state.view = 'detail';
  app.state.detailEx = [{ nombre: 'Remo', unidadPeso: 'KG', series: [{ peso: '40', reps: '8' }] }];
  app.state.exDone = ['mie#0#0'];
  const writes = [];
  app._db = {};
  app._fs = {
    doc(_db, collection, id) { return { collection, id }; },
    async setDoc(ref, patch) { writes.push({ ref, patch }); }
  };
  app.updateExerciseFeedback(0, 'peso', '37.5', 0);
  app.updateExerciseFeedback(0, 'reps', '9', 0);
  app.updateExerciseFeedback(0, 'rir', '2');
  await app._syncPromise;
  const key = 'exerciseFeedback_mie_0';
  const feedback = app.state.exerciseFeedback[key];
  assert.equal(feedback.sets[0].peso, '37.5');
  assert.equal(feedback.sets[0].reps, '9');
  assert.equal(feedback.sets[0].unidadPeso, 'KG');
  assert.equal(feedback.rir, '2');
  assert.equal(app.state.detailEx[0].series[0].peso, '40');
  assert.equal(app.state.dirty, false);
  assert.equal(app.state.sessionLogs.mie.series[0].source, 'explicit');
  assert.ok(writes.length >= 1);
  assert.ok(writes.every(w => w.ref.collection === 'progreso' && w.ref.id === '2026-W42'));
  assert.equal(localStorage.getItem('jessi-feedback-pending-2026-W42'), null);
});

test('el feedback sin conexión queda local y se reenvía al reconectar', async () => {
  memory.clear();
  const app = makeApp();
  app.weekKey = () => '2026-W42';
  app.state.rutinas = [{ _id: 'mie', nombre: 'Miércoles' }];
  app.state.selected = 0;
  app.state.view = 'detail';
  app.state.detailEx = [{ nombre: 'Remo', unidadPeso: 'LB', series: [{ peso: '80', reps: '8' }] }];
  app.updateExerciseFeedback(0, 'recovery', 'parcial');
  assert.equal(app.state.syncState, 'error');
  assert.equal(app.pendingFeedback('2026-W42').exerciseFeedback_mie_0.recovery, 'parcial');
  const fresh = makeApp();
  const writes = [];
  fresh._db = {};
  fresh._fs = { doc(_db, collection, id) { return { collection, id }; }, async setDoc(ref, patch) { writes.push({ ref, patch }); } };
  fresh.replayPendingFeedback();
  await fresh._syncPromise;
  assert.equal(writes[0].patch.exerciseFeedback_mie_0.recovery, 'parcial');
  assert.equal(localStorage.getItem('jessi-feedback-pending-2026-W42'), null);
});

test('un registro histórico conserva su origen no verificado', () => {
  const app = makeApp();
  app.weekKey = () => '2026-W42';
  app.state.rutinas = [{ _id: 'lun', nombre: 'Lunes' }];
  app.state.selected = 0;
  app.state.view = 'detail';
  app.state.detailEx = [{ nombre: 'Remo', unidadPeso: 'KG', series: [{ peso: '55', reps: '10' }] }];
  app._sessionLogs = { lun: { startedAt: 1, series: [{ key: '0#0', ejercicio: 'Remo', serie: 1, peso: '40', reps: '8', unidadPeso: 'KG', recordedAt: 1 }] } };
  const log = app.captureSession('lun', [], ['lun#0#0'], false);
  assert.equal(log.series[0].peso, '40');
  assert.equal(log.series[0].source, undefined);
});

test('miércoles muestra captura nueva vacía aunque la rutina tenga objetivos', () => {
  const app = makeApp();
  app.props = {};
  app.state.loading = false;
  app.state.rutinas = [{ _id: 'mie', nombre: 'Miércoles', ejercicios: [{ nombre: 'Remo', unidadPeso: 'LB', series: [{ peso: '40', reps: '9' }] }] }];
  app.open(0);
  let ex = app.renderVals().detail.ejercicios[0];
  assert.equal(ex.series[0].peso, '40');
  assert.equal(ex.actualSeries[0].peso, '');
  assert.equal(ex.actualSeries[0].reps, '');
  assert.equal(ex.actualSeries[0].unidadPeso, 'LB');
  app.state.exDone = ['mie#0#0'];
  ex = app.renderVals().detail.ejercicios[0];
  assert.match(ex.feedbackStatus, /0\/1 SERIES/);
});

test('el análisis usa resultados explícitos y respeta la exclusión de bienestar', () => {
  const app = makeApp();
  app.weekKey = () => '2026-W42';
  app.state.rutinas = [{ _id: 'mie', nombre: 'Miércoles' }];
  app._progDocs = {
    '2026-W42': {
      doneIds: [], exDone: ['mie#0#0'],
      sessionLog_mie: { dayName: 'Miércoles', series: [{ key: '0#0', ejercicio: 'Remo', serie: 1, peso: '40', reps: '9', unidadPeso: 'LB', source: 'explicit' }] },
      exerciseFeedback_mie_0: { dayId: 'mie', exerciseIndex: 0, exerciseName: 'Remo', sets: [{ peso: '40', reps: '9', unidadPeso: 'LB' }], rir: '2', discomfort: true }
    }
  };
  const without = app.buildAnalysisText('', '', false);
  assert.match(without, /resultado real explícito/);
  assert.match(without, /RIR: 2/);
  assert.doesNotMatch(without, /molestia articular/);
  assert.match(app.buildAnalysisText('', '', true), /molestia articular/);
});

test('una marca antigua no se convierte automáticamente en serie realizada', () => {
  const app = makeApp();
  app.weekKey = () => '2026-W40';
  app.state.rutinas = [{ _id: 'lun', nombre: 'Lunes' }];
  app.state.selected = 0;
  app.state.view = 'detail';
  app.state.detailEx = [{ nombre: 'Hip Thrust', unidadPeso: 'KG', series: [{ peso: '55', reps: '9' }] }];
  const log = app.captureSession('lun', ['lun'], ['lun#0#0'], true);
  assert.equal(log.series.length, 0);
  assert.equal(log.manualComplete, true);
});

test('el análisis no incorpora bienestar sin autorización', () => {
  const app = makeApp();
  app.state.rutinas = [{ _id: 'lun', nombre: 'Lunes' }];
  app._progDocs = {
    '2026-W39': { doneIds: ['lun'], exDone: [], wellness: { lun: { periodo: true, estres: 'mal' } } }
  };
  assert.doesNotMatch(app.buildAnalysisText('', '', false), /periodo menstrual/);
  assert.match(app.buildAnalysisText('', '', true), /periodo menstrual/);
});

test('un error de sincronización queda visible y puede reintentarse', async () => {
  const app = makeApp();
  let calls = 0;
  app._db = {};
  app._fs = {
    doc() { return {}; },
    async setDoc() { if (++calls === 1) throw new Error('sin red'); }
  };
  const first = await app.queueProgress({ doneIds: ['lun'] }, '2026-W40');
  assert.equal(first, false);
  assert.equal(app.state.syncState, 'error');
  assert.equal(app._progressQueue.length, 1);
  const second = await app.retrySync();
  assert.equal(second, true);
  assert.equal(app.state.syncState, 'saved');
  assert.equal(app._progressQueue.length, 0);
});

test('no sobrescribe una rutina editada desde otro dispositivo', async () => {
  const app = makeApp();
  app._db = {};
  const edited = [{ nombre: 'Hip Thrust', series: [{ peso: '60', reps: '8' }] }];
  app._fs = {
    doc() { return {}; },
    async runTransaction(_db, callback) {
      return callback({
        async get() { return { exists: () => true, data: () => ({ ejercicios: edited }) }; },
        update() { throw new Error('No debe actualizar'); }
      });
    }
  };
  await assert.rejects(
    app.updateRoutineIfUnchanged({ _id: 'lun', ejercicios: [{ nombre: 'Hip Thrust', series: [{ peso: '55', reps: '8' }] }] }, edited),
    /RUTINA_CAMBIADA_EN_OTRO_DISPOSITIVO/
  );
});

test('solicitar video deja una petición pendiente y un aviso de guardado', () => {
  const app = makeApp();
  app.state.detailEx = [{ nombre: 'Hip Thrust', solicitarVideo: false }];
  app.toggleVideo(0);
  assert.equal(app.state.detailEx[0].solicitarVideo, true);
  assert.equal(app.state.detailEx[0].videoEstado, 'pendiente');
  assert.ok(app.state.detailEx[0].videoSolicitadoAt > 0);
  assert.equal(app.state.dirty, true);
  assert.equal(app.state.videoDirty[0], 0);
});
