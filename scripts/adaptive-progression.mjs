import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { weekKey, decodeFields, encode } from './weekly-progression.mjs';

const PROJECT = 'asesoriasjessi';
const POLICY = 'reviewed-rp-v1';

export function shiftWeek(key, weeks) {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(key || '');
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 53) throw new Error('Semana inválida');
  const jan4 = new Date(Date.UTC(Number(match[1]), 0, 4));
  jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (Number(match[2]) - 1 + weeks) * 7);
  if (weekKey(new Date(jan4.getTime() + 20 * 3600000)) !== key && weeks === 0) throw new Error('Semana inválida');
  return weekKey(new Date(jan4.getTime() + 20 * 3600000));
}

function weekStart(key) {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(key || '');
  if (!match) throw new Error('Semana inválida');
  const jan4 = new Date(Date.UTC(Number(match[1]), 0, 4));
  jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (Number(match[2]) - 1) * 7);
  return jan4.getTime();
}

const docId = doc => doc.name.split('/').pop();
const numeric = value => Number(String(value ?? '').trim().replace(',', '.'));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

function fingerprint(routines, source, previous) {
  const material = {
    routines: routines.map(doc => ({ id: docId(doc), updateTime: doc.updateTime, data: decodeFields(doc.fields) })),
    source: decodeFields(source?.fields), previous: decodeFields(previous?.fields),
  };
  return createHash('sha256').update(JSON.stringify(canonical(material))).digest('hex');
}

function loadOfTarget(serie, exercise) {
  const text = String(serie.peso ?? '').trim();
  const unit = String(exercise.unidadPeso || '').toUpperCase();
  if (unit === 'SIN_CARGA' && !text) return { unit, load: 0 };
  const match = /^(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs|nivel|niveles)?$/i.exec(text);
  if (!match) return null;
  const suffix = (match[2] || '').toUpperCase();
  const suffixUnit = suffix.startsWith('KG') ? 'KG' : suffix.startsWith('LB') ? 'LB' : suffix ? 'NIVEL' : '';
  if (!['KG', 'LB', 'NIVEL'].includes(unit) || (suffixUnit && suffixUnit !== unit)) return null;
  const load = numeric(match[1]);
  return Number.isFinite(load) && load > 0 ? { unit, load } : null;
}

function actualMatches(actual, target) {
  const reps = Number(String(actual?.reps ?? '').trim());
  if (!Number.isInteger(reps) || reps < 1 || actual?.unidadPeso !== target.unit) return false;
  if (target.unit === 'SIN_CARGA') return true;
  const load = numeric(actual.peso);
  return Number.isFinite(load) && load > 0 && Math.abs(load - target.load) < 0.01;
}

function numericRir(value) {
  if (value === '6+') return 6;
  if (!/^[0-5]$/.test(String(value ?? ''))) return null;
  return Number(value);
}

function priorComparable(previous, routineId, index, exerciseName, currentTargets, maxReps) {
  if (!(previous.doneIds || []).includes(routineId)) return false;
  const feedback = previous[`exerciseFeedback_${routineId}_${index}`];
  if (!feedback || feedback.schemaVersion !== 1 || feedback.exerciseName !== exerciseName ||
      feedback.discomfort || feedback.soreness ||
      feedback.recovery !== 'buena' || feedback.difficulty === 'muy_dificil' || numericRir(feedback.rir) < 2) return false;
  const checked = new Set(previous.exDone || []);
  if (!Array.isArray(feedback.sets) || feedback.sets.length < currentTargets.length) return false;
  return currentTargets.every((target, setIndex) => checked.has(`${routineId}#${index}#${setIndex}`) &&
    actualMatches(feedback.sets[setIndex], target) && Number(feedback.sets[setIndex].reps) >= maxReps);
}

function assessExercise(routineId, exercise, index, source, previous, routine) {
  const id = `${routineId}#${index}`;
  const base = { id, routineId, exerciseIndex: index, exerciseName: exercise.nombre || `Ejercicio ${index + 1}`,
    action: 'hold', reason: '', missing: [], changes: [], evidence: {} };
  const hold = (reason, missing = []) => ({ ...base, reason, missing });
  if (routine.progWeek !== source.week) return hold('La rutina aún no está programada para la semana de origen.', ['rutina vigente']);
  if (routine.deloadActive || routine.progresionPausada) return hold('Rutina en descarga o progresión pausada por el asesor.');
  if (exercise.progresionPausada) return hold('Progresión pausada por el asesor.');
  if (!(source.doneIds || []).includes(routineId)) return hold('El día no está marcado como terminado.', ['día completo']);
  const series = Array.isArray(exercise.series) ? exercise.series : [];
  if (!series.length) return hold('El ejercicio no tiene series definidas.', ['series']);
  const checked = new Set(source.exDone || []);
  if (!series.every((_, setIndex) => checked.has(`${routineId}#${index}#${setIndex}`))) {
    return hold('Faltan series marcadas como realizadas.', ['series completas']);
  }
  const feedback = source[`exerciseFeedback_${routineId}_${index}`];
  if (!feedback || feedback.schemaVersion !== 1 || feedback.dayId !== routineId || feedback.exerciseIndex !== index ||
      (feedback.exerciseName && feedback.exerciseName !== exercise.nombre)) {
    return hold('No hay un resultado explícito comparable para este ejercicio.', ['resultado real']);
  }
  const config = exercise.progressionConfig || {};
  const min = config.minReps == null ? 8 : Number(config.minReps);
  const max = config.maxReps == null ? 12 : Number(config.maxReps);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 30) {
    return hold('Rango de repeticiones inválido; requiere revisión.', ['rango aprobado']);
  }
  const targets = series.map(serie => loadOfTarget(serie, exercise));
  const plannedReps = series.map(serie => Number(String(serie.reps ?? '').trim()));
  if (targets.some(target => !target) || plannedReps.some(reps => !Number.isInteger(reps) || reps < min || reps > max)) {
    return { ...base, action: 'review', reason: `Prescripción no comparable con el rango ${min}–${max} o unidad/carga ambigua.`,
      missing: ['rango o unidad de carga'] };
  }
  if (!Array.isArray(feedback.sets) || feedback.sets.length < series.length ||
      !series.every((_, setIndex) => actualMatches(feedback.sets[setIndex], targets[setIndex]))) {
    return hold('Faltan cargas/repeticiones reales o no coinciden las unidades y cargas prescritas.', ['resultado real comparable']);
  }
  if (feedback.sets.some((actual, setIndex) => setIndex < series.length && Number(actual.reps) < plannedReps[setIndex])) {
    return hold('No se alcanzaron todas las repeticiones objetivo.');
  }
  const rir = numericRir(feedback.rir);
  if (rir === null || !['facil', 'adecuada', 'muy_dificil'].includes(feedback.difficulty) ||
      !['buena', 'parcial', 'insuficiente'].includes(feedback.recovery)) {
    return hold('Faltan RIR, dificultad o recuperación.', ['sensaciones completas']);
  }
  const evidence = { actual: feedback.sets.slice(0, series.length).map(se => ({ peso: se.peso || '',
    unidadPeso: se.unidadPeso || '', reps: se.reps || '' })), rir: feedback.rir,
    difficulty: feedback.difficulty, recovery: feedback.recovery, pump: feedback.pump || '',
    soreness: !!feedback.soreness, discomfort: !!feedback.discomfort };
  if (feedback.discomfort || feedback.soreness) return { ...base, evidence, action: 'review', reason: 'Molestia articular o agujetas limitantes: no proponer aumento.' };
  if (feedback.recovery !== 'buena' || feedback.difficulty === 'muy_dificil' || rir < 2) {
    return { ...base, evidence, reason: 'Recuperación, dificultad o RIR no justifican un aumento.' };
  }
  const belowMax = plannedReps.map((reps, i) => reps < max ? i : -1).filter(i => i >= 0);
  if (belowMax.length) {
    const changes = belowMax.map(setIndex => ({ setIndex, before: { peso: series[setIndex].peso, reps: series[setIndex].reps },
      after: { peso: series[setIndex].peso, reps: String(plannedReps[setIndex] + 1) } }));
    return { ...base, action: 'increase_reps', reason: 'Objetivo completado con RIR ≥ 2 y buena recuperación; +1 repetición dentro del rango.',
      changes, evidence, requiresCoachReview: ['técnica', 'selección explícita'] };
  }
  if (!priorComparable(previous, routineId, index, exercise.nombre, targets, max)) {
    return { ...base, evidence, reason: 'Se requiere una segunda exposición comparable en el máximo del rango.' };
  }
  const step = numeric(config.loadStep);
  const unit = targets[0].unit;
  if (!Number.isFinite(step) || step <= 0 || config.loadStepUnit !== unit || unit === 'SIN_CARGA' ||
      targets.some(target => target.unit !== unit || step / target.load > 0.05)) {
    return { ...base, evidence, action: 'review', reason: 'Se cumplió el máximo dos veces; falta confirmar el menor salto de carga disponible (≤5%).',
      missing: ['salto de carga aprobado'] };
  }
  const changes = series.map((serie, setIndex) => ({ setIndex, before: { peso: serie.peso, reps: serie.reps },
    after: { peso: String(Number((targets[setIndex].load + step).toFixed(2))), reps: String(min) } }));
  return { ...base, action: 'increase_load', reason: 'Máximo del rango en dos exposiciones comparables; salto de carga configurado y vuelta al mínimo.',
    changes, evidence, requiresCoachReview: ['técnica', 'selección explícita'] };
}

export function buildAdaptiveDraft(routineDocs, sourceDoc, previousDoc, sourceWeek, now = new Date()) {
  const routines = routineDocs.filter(doc => !decodeFields(doc.fields).archivada).sort((a, b) => docId(a).localeCompare(docId(b)));
  if (!routines.length) throw new Error('Sin rutinas activas');
  const source = { ...decodeFields(sourceDoc?.fields), week: sourceWeek };
  const previous = decodeFields(previousDoc?.fields);
  const targetWeek = shiftWeek(sourceWeek, 1);
  const inputHash = fingerprint(routines, sourceDoc, previousDoc);
  const items = routines.flatMap(doc => {
    const routine = decodeFields(doc.fields);
    const id = docId(doc);
    return (routine.ejercicios || []).map((exercise, index) =>
      assessExercise(id, exercise, index, source, previous, routine));
  });
  return {
    schemaVersion: 1, policy: POLICY, state: 'pending', id: `${targetWeek}-${inputHash.slice(0, 16)}`,
    sourceWeek, targetWeek, inputHash, generatedAt: now.toISOString(),
    routineVersions: Object.fromEntries(routines.map(doc => [docId(doc), doc.updateTime])),
    items, summary: {
      candidates: items.filter(item => item.action === 'increase_reps' || item.action === 'increase_load').length,
      review: items.filter(item => item.action === 'review').length,
      hold: items.filter(item => item.action === 'hold').length,
    },
  };
}

function targetStarted(progress) {
  return (progress.exDone || []).length > 0 || (progress.doneIds || []).length > 0 ||
    Object.entries(progress).some(([key, log]) => key.startsWith('sessionLog_') &&
      (log?.startedAt || log?.completedAt || log?.manualComplete || log?.series?.length));
}

function sourceFullyComplete(routines, progress) {
  const done = new Set(progress.doneIds || []);
  const marked = new Set(progress.exDone || []);
  return routines.filter(doc => !decodeFields(doc.fields).archivada).every(doc => {
    const routine = decodeFields(doc.fields);
    const id = docId(doc);
    return done.has(id) && (routine.ejercicios || []).every((exercise, index) =>
      (exercise.series || []).every((_, setIndex) => marked.has(`${id}#${index}#${setIndex}`)));
  });
}

function firestore(apiKey, projectId, fetchImpl) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  async function request(path, options = {}, allowMissing = false) {
    const url = new URL(`${base}/${path}`);
    url.searchParams.set('key', apiKey);
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(30000) });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`Firestore HTTP ${response.status}`);
    return response.json();
  }
  async function listRoutines() {
    const docs = [];
    let token = '';
    do {
      const params = new URLSearchParams({ pageSize: '100', ...(token ? { pageToken: token } : {}) });
      const page = await request(`rutinas?${params}`);
      docs.push(...(page.documents || []));
      token = page.nextPageToken || '';
    } while (token);
    return docs;
  }
  async function commit(writes) {
    const url = new URL(`${base}:commit`);
    url.searchParams.set('key', apiKey);
    const response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ writes }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Commit cancelado (HTTP ${response.status}); releer antes de reintentar`);
  }
  const name = path => `${base.replace('https://firestore.googleapis.com/v1/', '')}/${path}`;
  const progressWrite = (week, patch, current) => ({
    update: { name: name(`progreso/${week}`), fields: Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, encode(value)])) },
    updateMask: { fieldPaths: Object.keys(patch) },
    currentDocument: current ? { updateTime: current.updateTime } : { exists: false },
  });
  return { request, listRoutines, commit, name, progressWrite };
}

export async function generateDraft({ apiKey, projectId = PROJECT, now = new Date(), fetchImpl = fetch }) {
  if (!apiKey) throw new Error('Falta FIREBASE_API_KEY');
  const sourceWeek = weekKey(now);
  const targetWeek = shiftWeek(sourceWeek, 1);
  const db = firestore(apiKey, projectId, fetchImpl);
  const [routines, sourceDoc, previousDoc, targetDoc] = await Promise.all([
    db.listRoutines(), db.request(`progreso/${sourceWeek}`, {}, true),
    db.request(`progreso/${shiftWeek(sourceWeek, -1)}`, {}, true), db.request(`progreso/${targetWeek}`, {}, true),
  ]);
  const target = decodeFields(targetDoc?.fields);
  if (targetStarted(target) || target.progression || target.adaptiveDecision?.decision === 'approve') {
    return { sourceWeek, targetWeek, skipped: 'Semana destino iniciada o ya actualizada.' };
  }
  const draft = buildAdaptiveDraft(routines, sourceDoc, previousDoc, sourceWeek, now);
  if (target.adaptiveDecision?.decision === 'reject' && target.adaptiveDecision.draftId === draft.id) {
    return { sourceWeek, targetWeek, id: draft.id, skipped: 'Borrador rechazado sin datos nuevos.' };
  }
  if (target.adaptiveDraft?.id === draft.id && target.adaptiveDraft?.state === 'pending' &&
      target.adaptiveDraft?.policy === POLICY &&
      JSON.stringify(canonical(target.adaptiveDraft.items)) === JSON.stringify(canonical(draft.items))) {
    return { sourceWeek, targetWeek, id: draft.id, unchanged: true, summary: draft.summary };
  }
  const history = Array.isArray(target.adaptiveDraftHistory) ? target.adaptiveDraftHistory.slice(-7) : [];
  if (target.adaptiveDraft) history.push(target.adaptiveDraft);
  await db.commit([db.progressWrite(targetWeek, { adaptiveDraft: draft, adaptiveDraftHistory: history }, targetDoc)]);
  const saved = decodeFields((await db.request(`progreso/${targetWeek}`)).fields).adaptiveDraft;
  if (saved?.id !== draft.id || saved.state !== 'pending') throw new Error('Verificación del borrador fallida');
  return { sourceWeek, targetWeek, id: draft.id, summary: draft.summary, verified: true };
}

export async function inspectDraft({ apiKey, projectId = PROJECT, targetWeek, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('Falta FIREBASE_API_KEY');
  if (!/^\d{4}-W\d{1,2}$/.test(targetWeek || '')) throw new Error('Semana destino inválida');
  const db = firestore(apiKey, projectId, fetchImpl);
  const doc = await db.request(`progreso/${targetWeek}`, {}, true);
  return decodeFields(doc?.fields).adaptiveDraft || null;
}

export async function reviewDraft({ apiKey, projectId = PROJECT, now = new Date(), targetWeek, draftId,
  decision, approvedExercises = [], techniqueConfirmed = false, reviewer = '', fetchImpl = fetch }) {
  if (!apiKey) throw new Error('Falta FIREBASE_API_KEY');
  if (!['approve', 'reject'].includes(decision)) throw new Error('Decisión inválida');
  if (!/^\d{4}-W\d{1,2}$/.test(targetWeek || '') || !draftId || !reviewer) throw new Error('Faltan semana, borrador o revisor');
  const sourceWeek = shiftWeek(targetWeek, -1);
  if (weekStart(weekKey(now)) > weekStart(targetWeek)) throw new Error('La semana destino ya pasó');
  const db = firestore(apiKey, projectId, fetchImpl);
  const [routines, sourceDoc, previousDoc, targetDoc] = await Promise.all([
    db.listRoutines(), db.request(`progreso/${sourceWeek}`, {}, true),
    db.request(`progreso/${shiftWeek(sourceWeek, -1)}`, {}, true), db.request(`progreso/${targetWeek}`, {}, true),
  ]);
  const target = decodeFields(targetDoc?.fields);
  const source = decodeFields(sourceDoc?.fields);
  if (!targetDoc || targetStarted(target) || target.progression) throw new Error('Semana destino iniciada o ya actualizada');
  if (decision === 'approve' && weekKey(now) === sourceWeek && !sourceFullyComplete(routines, source)) {
    throw new Error('La semana de origen sigue abierta; esperar a terminarla o a la semana destino');
  }
  const saved = target.adaptiveDraft;
  const recalculated = buildAdaptiveDraft(routines, sourceDoc, previousDoc, sourceWeek, now);
  if (!saved || saved.state !== 'pending' || saved.id !== draftId || recalculated.id !== draftId ||
      saved.inputHash !== recalculated.inputHash || saved.policy !== POLICY ||
      JSON.stringify(canonical(saved.items)) !== JSON.stringify(canonical(recalculated.items))) {
    throw new Error('Borrador vencido: regenerar y revisar');
  }
  const approved = [...new Set(approvedExercises.map(id => id.trim()).filter(Boolean))];
  if (decision === 'approve' && (!techniqueConfirmed || !approved.length)) {
    throw new Error('La aprobación requiere técnica revisada y ejercicios elegidos explícitamente');
  }
  if (decision === 'reject' && approved.length) throw new Error('El rechazo no acepta ejercicios aprobados');
  const candidates = new Map(recalculated.items.filter(item => item.changes.length).map(item => [item.id, item]));
  if (approved.some(id => !candidates.has(id))) throw new Error('Hay ejercicios no propuestos o inválidos');
  const decisionRecord = { schemaVersion: 1, policy: POLICY, decision, draftId, reviewer,
    reviewedAt: now.toISOString(), techniqueConfirmed: !!techniqueConfirmed, approvedExercises: approved,
    changes: approved.flatMap(id => candidates.get(id).changes.map(change => ({ exerciseId: id, ...change }))) };
  const writes = [];
  const expectedRoutines = new Map();
  if (decision === 'approve') {
    for (const doc of routines.filter(doc => !decodeFields(doc.fields).archivada)) {
      const routine = decodeFields(doc.fields);
      if (routine.progWeek !== sourceWeek) throw new Error('La rutina cambió de semana; regenerar propuesta');
      const id = docId(doc);
      const exercises = (routine.ejercicios || []).map((exercise, index) => {
        const item = candidates.get(`${id}#${index}`);
        if (!item || !approved.includes(item.id)) return exercise;
        const series = (exercise.series || []).map((serie, setIndex) => {
          const change = item.changes.find(entry => entry.setIndex === setIndex);
          return change ? { ...serie, ...change.after } : serie;
        });
        return { ...exercise, series, sets: series.length, peso: series[0]?.peso ?? '', reps: series[0]?.reps ?? '' };
      });
      const patch = { progWeek: targetWeek, ejercicios: exercises };
      expectedRoutines.set(id, exercises);
      writes.push({ update: { name: doc.name, fields: encode(patch).mapValue.fields },
        updateMask: { fieldPaths: Object.keys(patch) }, currentDocument: { updateTime: doc.updateTime } });
    }
  }
  const updatedDraft = { ...saved, state: decision === 'approve' ? 'applied' : 'rejected', reviewedAt: now.toISOString() };
  const progressPatch = { adaptiveDraft: updatedDraft, adaptiveDecision: decisionRecord };
  if (decision === 'approve') progressPatch.progression = {
    week: targetWeek, sourceWeek, mode: 'reviewed', policy: POLICY, appliedAt: now.toISOString(),
    draftId, reviewer, approvedExercises: approved, changes: decisionRecord.changes,
  };
  writes.push(db.progressWrite(targetWeek, progressPatch, targetDoc));
  await db.commit(writes);
  const verifiedProgress = decodeFields((await db.request(`progreso/${targetWeek}`)).fields);
  if (verifiedProgress.adaptiveDecision?.draftId !== draftId || verifiedProgress.adaptiveDecision?.decision !== decision) {
    throw new Error('Verificación de decisión fallida');
  }
  if (decision === 'approve') {
    for (const doc of routines.filter(doc => !decodeFields(doc.fields).archivada)) {
      const current = decodeFields((await db.request(`rutinas/${docId(doc)}`)).fields);
      if (current.progWeek !== targetWeek ||
          JSON.stringify(canonical(current.ejercicios)) !== JSON.stringify(canonical(expectedRoutines.get(docId(doc))))) {
        throw new Error('Verificación de rutina fallida');
      }
    }
  }
  return { targetWeek, decision, draftId, approvedExercises: approved, changedSeries: decisionRecord.changes.length, verified: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = { apiKey: process.env.FIREBASE_API_KEY, projectId: process.env.FIREBASE_PROJECT_ID || PROJECT,
    now: new Date(), targetWeek: process.env.TARGET_WEEK, draftId: process.env.DRAFT_ID,
    approvedExercises: (process.env.APPROVED_EXERCISES || '').split(','),
    techniqueConfirmed: process.env.TECHNIQUE_CONFIRMED === 'true', reviewer: process.env.GITHUB_ACTOR || process.env.REVIEWER || '' };
  const mode = process.env.RUN_MODE || 'draft';
  const command = mode === 'approve' || mode === 'reject' ? reviewDraft({ ...args, decision: mode })
    : mode === 'inspect' ? inspectDraft(args) : mode === 'draft' ? generateDraft(args)
      : Promise.reject(new Error('Modo inválido'));
  command
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
