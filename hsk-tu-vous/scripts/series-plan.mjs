const weekdays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function dateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) throw Error('Expected a real YYYY-MM-DD date');
  const date = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value)
    throw Error('Invalid calendar date ' + value);
  return date;
}

function addDays(value, days) {
  const date = dateValue(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function requirePolicy(calendar) {
  const policy = calendar.seriesPolicy;
  if (policy?.schemaVersion !== 1 || policy.continuationGapDays !== 1 ||
      policy.allowContinuationOutsidePlanningWeekdays !== true || policy.requireCompleteDraftSet !== true)
    throw Error('Invalid calendar.seriesPolicy: consecutive-day continuations and a complete draft set are required');
  return policy;
}

/** Calendar-only identity: no duplicate series dates/part numbers in lesson files. */
export function validateSeriesCalendar(calendar) {
  const errors = [];
  if (!Array.isArray(calendar?.items)) return ['Missing calendar.items'];
  const parts = calendar.items.filter(item => item?.series !== undefined);
  if (!parts.length && calendar.seriesPolicy === undefined) return errors; // Legacy calendars.
  let policy;
  try { policy = requirePolicy(calendar); } catch (error) { return [error.message]; }
  const groups = new Map();
  for (const item of parts) {
    const s = item.series;
    if (!s || !idPattern.test(s.id ?? '') || !Number.isSafeInteger(s.part) ||
        !Number.isSafeInteger(s.totalParts) || s.totalParts < 2 || s.part < 1 || s.part > s.totalParts) {
      errors.push(`${item.id}: invalid series id, part or totalParts`);
      continue;
    }
    try { dateValue(item.date); } catch (error) { errors.push(`${item.id}: ${error.message}`); continue; }
    if (!groups.has(s.id)) groups.set(s.id, []);
    groups.get(s.id).push(item);
  }
  for (const [id, items] of groups) {
    const ordered = [...items].sort((a, b) => a.series.part - b.series.part);
    const total = ordered[0].series.totalParts;
    if (ordered.length !== total || new Set(ordered.map(x => x.series.part)).size !== total ||
        ordered.some(x => x.series.totalParts !== total) || ordered[0].series.part !== 1) {
      errors.push(`${id}: register the complete, uniquely numbered series before its first part`);
      continue;
    }
    const first = ordered[0];
    if (!calendar.planningWeekdays?.includes(weekdays[dateValue(first.date).getUTCDay()]))
      errors.push(`${id}: the first part must use a regular planning weekday`);
    for (const item of ordered) {
      const expected = addDays(first.date, (item.series.part - 1) * policy.continuationGapDays);
      if (item.date !== expected)
        errors.push(`${id} part ${item.series.part}: expected next consecutive date ${expected}, got ${item.date}`);
      if (calendar.items.some(other => other !== item && other.date === item.date))
        errors.push(`${id} part ${item.series.part}: date ${item.date} conflicts with another calendar item`);
    }
  }
  return errors;
}

/** A proposal, not a reservation, completed script or publishing authorization. */
export function proposeSeries(calendar, {seriesId, startDate, totalParts, today} = {}) {
  const policy = requirePolicy(calendar);
  const errors = validateSeriesCalendar(calendar);
  if (errors.length) throw Error(errors.join('\n'));
  if (!idPattern.test(seriesId ?? '')) throw Error('Use a lowercase hyphenated series ID');
  // Bound one read-only planning request; not an editorial series-length rule.
  if (!Number.isSafeInteger(totalParts) || totalParts < 2 || totalParts > 366)
    throw Error('A planning request needs 2–366 parts');
  dateValue(today);
  const start = dateValue(startDate);
  if (startDate <= today) throw Error('A new series must start in the future');
  if (!calendar.planningWeekdays?.includes(weekdays[start.getUTCDay()]))
    throw Error('The first part must use a regular planning weekday');
  if (calendar.items.some(item => item.series?.id === seriesId)) throw Error('Series ID already exists');
  const propose = Array.from({length: totalParts}, (_, index) => ({
    type: 'author-new-script', date: addDays(startDate, index * policy.continuationGapDays),
    series: {id: seriesId, part: index + 1, totalParts},
    requiresVerifiedLearningFacts: true, requiresHookExperiment: true,
    ctaSource: 'content/cta-lab.json', status: 'planned',
  }));
  for (const item of propose) {
    if (calendar.items.some(existing => existing.date === item.date))
      throw Error(`Series date ${item.date} is occupied; do not move an existing episode or skip a day`);
  }
  return {date: today, timeZone: calendar.timezone, seriesId, propose,
    proposalsAreScripts: false, requiresCompleteDraftSet: policy.requireCompleteDraftSet,
    publicationAuthorized: false,
    note: 'Author and verify every part in all production languages before registering the complete set. Each part must resolve its own useful lesson; dates do not schedule social posts.'};
}
