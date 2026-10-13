import { pathToFileURL } from 'node:url';

export const TIME_ZONE = 'America/Tijuana';

export function weekKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = type => Number(parts.find(p => p.type === type).value);
  const date = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const week = Math.ceil((((date - Date.UTC(year, 0, 1)) / 86400000) + 1) / 7);
  return `${year}-W${week}`; // Compatible con las claves históricas del frontend.
}

function weekNumber(key) {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(key || '');
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 53) throw new Error('Semana inválida');
  return Number(match[1]) * 100 + Number(match[2]);
}

export function decode(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields);
  if ('timestampValue' in value) return value.timestampValue;
  throw new Error('Tipo Firestore no soportado');
}

export function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

export function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === 'object') {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, val]) => [key, encode(val)])) } };
  }
  throw new Error('Valor no soportado');
}

export function progressExercise(exercise) {
  const original = Array.isArray(exercise.series) && exercise.series.length
    ? exercise.series
    : Array.from({ length: Math.min(20, Math.max(1, parseInt(exercise.sets, 10) || 1)) }, () => ({ peso: exercise.peso || '', reps: exercise.reps || '' }));
  const changes = [];
  const series = original.map((serie, index) => {
    const text = String(serie.reps ?? '').trim();
    // No convertir «fallo», minutos o rangos en repeticiones numéricas.
    if (!/^\d+$/.test(text)) return { ...serie };
    const reps = Number(text);
    if (reps < 1) return { ...serie };
    let next = { ...serie, reps: String(reps + 1) };
    let reason = 'repeticion';
    if (reps >= 12) {
      const weight = String(serie.peso ?? '').trim();
      const match = /^(\d+(?:\.\d+)?)\s*(kg|kgs|lb|lbs|nivel(?:es)?)?$/i.exec(weight);
      const tag = (match?.[2] || exercise.unidadPeso || '').toUpperCase();
      const increment = tag.startsWith('NIVEL') ? 1 : tag.startsWith('KG') ? 5 : tag.startsWith('LB') ? 10 : 0;
      if (!match || !increment) return { ...serie }; // Nunca adivinar KG/LB.
      const updated = Number((Number(match[1]) + increment).toFixed(2));
      next = { ...serie, peso: `${updated}${match[2] ? ' ' + match[2] : ''}`, reps: '8' };
      reason = 'carga';
    }
    changes.push({ serie: index, antes: { peso: serie.peso ?? '', reps: serie.reps ?? '' }, despues: { peso: next.peso ?? '', reps: next.reps }, motivo: reason });
    return next;
  });
  if (!changes.length) return { exercise: { ...exercise }, changes };
  return { exercise: { ...exercise, series, sets: series.length, peso: series[0].peso ?? '', reps: series[0].reps ?? '' }, changes };
}

export function buildPlan(documents, progressDocument, week, mode = 'weekly', allowStarted = false) {
  if (!['weekly', 'baseline'].includes(mode)) throw new Error('Modo inválido');
  const progress = decodeFields(progressDocument?.fields);
  const started = (progress.exDone || []).length > 0 || (progress.doneIds || []).length > 0 ||
    Object.entries(progress).some(([key, log]) => key.startsWith('sessionLog_') && (log.startedAt || log.completedAt || log.manualComplete || log.series?.length));
  const updates = [];
  for (const document of documents) {
    const routine = decodeFields(document.fields);
    if (routine.archivada) continue;
    if (routine.progWeek && weekNumber(routine.progWeek) > weekNumber(week)) throw new Error('Rutina adelantada; revisar antes de escribir');
    if (routine.progWeek && weekNumber(routine.progWeek) === weekNumber(week)) continue;
    let reason = mode === 'baseline' || !routine.progWeek ? 'linea_base' : started && !allowStarted ? 'semana_iniciada' :
      routine.progresionPausada || routine.deloadActive ? 'pausada' : 'progresion';
    const patch = { progWeek: week };
    const changes = [];
    if (reason === 'progresion') {
      const exercises = (routine.ejercicios || []).map((exercise, index) => {
        const result = exercise.progresionPausada ? { exercise, changes: [] } : progressExercise(exercise);
        changes.push(...result.changes.map(change => ({ ejercicio: index, ...change })));
        return result.exercise;
      });
      if (changes.length) patch.ejercicios = exercises;
      else reason = 'sin_cambios';
    }
    updates.push({ document, routine, patch, reason, changes });
  }
  return { updates, started };
}

export async function run({ apiKey, projectId = 'asesoriasjessi', now = new Date(), mode = 'weekly', apply = false, allowStarted = false, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('Falta FIREBASE_API_KEY');
  const week = weekKey(now);
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  async function request(path, options = {}, allowMissing = false) {
    const url = new URL(base + '/' + path);
    url.searchParams.set('key', apiKey);
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(30000) });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`Firestore HTTP ${response.status}`);
    return response.json();
  }
  const documents = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '100', ...(pageToken ? { pageToken } : {}) });
    const page = await request(`rutinas?${query}`);
    documents.push(...(page.documents || []));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  if (!documents.some(doc => !decodeFields(doc.fields).archivada)) throw new Error('Sin rutinas activas');
  const progressDocument = await request(`progreso/${week}`, {}, true);
  const { updates, started } = buildPlan(documents, progressDocument, week, mode, allowStarted);
  const summary = {
    week, mode, apply, routines: updates.length,
    changedSeries: updates.reduce((n, item) => n + item.changes.length, 0),
    started, verified: false,
  };
  if (!apply || !updates.length) return summary;
  const fields = patch => Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, encode(value)]));
  const writes = updates.map(item => ({
    update: { name: item.document.name, fields: fields(item.patch) },
    updateMask: { fieldPaths: Object.keys(item.patch) },
    currentDocument: { updateTime: item.document.updateTime },
  }));
  const progression = {
    week, mode, policy: 'legacy-v1', allowStarted, appliedAt: now.toISOString(),
    routines: updates.map(item => ({ id: item.document.name.split('/').pop(), previousWeek: item.routine.progWeek || '', reason: item.reason, changes: item.changes })),
  };
  writes.push({
    update: { name: `${base.replace('https://firestore.googleapis.com/v1/', '')}/progreso/${week}`, fields: fields({ progression }) },
    updateMask: { fieldPaths: ['progression'] },
    currentDocument: progressDocument ? { updateTime: progressDocument.updateTime } : { exists: false },
  });
  // Un único commit atómico: cualquier edición o sesión concurrente cancela todo.
  const commitUrl = new URL(base + ':commit');
  commitUrl.searchParams.set('key', apiKey);
  const committed = await fetchImpl(commitUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ writes }), signal: AbortSignal.timeout(30000) });
  if (!committed.ok) throw new Error(`Commit cancelado (HTTP ${committed.status}); releer antes de reintentar`);
  // No reintentar a ciegas tras un timeout: progWeek hace idempotente una nueva ejecución.
  for (const item of updates) {
    const current = decodeFields((await request(`rutinas/${item.document.name.split('/').pop()}`)).fields);
    const expected = item.patch.ejercicios || item.routine.ejercicios;
    if (current.progWeek !== week || JSON.stringify(encode(current.ejercicios)) !== JSON.stringify(encode(expected))) {
      // El orden de claves puede cambiar en la API; comparar un formato canónico.
      const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
      if (current.progWeek !== week || JSON.stringify(canonical(current.ejercicios)) !== JSON.stringify(canonical(expected))) throw new Error('Verificación de rutina fallida');
    }
  }
  const audit = decodeFields((await request(`progreso/${week}`)).fields).progression;
  if (audit?.week !== week || audit.appliedAt !== progression.appliedAt) throw new Error('Verificación de auditoría fallida');
  return { ...summary, verified: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ apiKey: process.env.FIREBASE_API_KEY, projectId: process.env.FIREBASE_PROJECT_ID || 'asesoriasjessi',
    mode: process.argv.includes('--baseline') ? 'baseline' : 'weekly', apply: process.argv.includes('--apply'),
    allowStarted: process.argv.includes('--allow-started') })
    .then(summary => console.log(JSON.stringify(summary)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
