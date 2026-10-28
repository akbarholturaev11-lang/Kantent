import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zernioRoute, zernioTargetAccount } from "./video-credentials.mjs";

const API_ROOT = "https://zernio.com/api/v1";
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGUAGE = process.env.ZERNIO_TIME_LANGUAGE ?? "ru";
const PLATFORM = process.env.ZERNIO_TIME_PLATFORM ?? "instagram";
const TARGET_DATE = process.env.ZERNIO_TIME_TARGET_DATE ?? "";
const LOOKBACK_DAYS = 30;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

function assertTargetDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw Error("Provide ZERNIO_TIME_TARGET_DATE as a real YYYY-MM-DD date.");
  }
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function localWeekday(dateString, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(new Date(`${dateString}T12:00:00Z`));
}

function utcSlotToLocal(slot, timezone) {
  const day = Number(slot.day_of_week ?? slot.dayofweek);
  const hour = Number(slot.hour);
  if (!Number.isInteger(day) || day < 0 || day > 6 || !Number.isInteger(hour) || hour < 0 || hour > 23)
    return null;
  // Zernio defines day_of_week as Monday=0..Sunday=6 and hour as UTC.
  const instant = new Date(Date.UTC(2024, 0, 1 + day, hour));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    localWeekday: values.weekday,
    localHour: Number(values.hour),
    localTime: `${values.hour}:00`,
  };
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.posts)) return payload.posts;
  if (Array.isArray(payload?.analytics)) return payload.analytics;
  if (Array.isArray(payload?.data?.posts)) return payload.data.posts;
  return [];
}

function extractSlots(payload) {
  const body = payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
  return Array.isArray(body?.slots) ? body.slots : [];
}

async function getJson(route, token) {
  const response = await fetch(API_ROOT + route, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw Error(`Zernio analytics endpoint returned HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw Error("Zernio analytics endpoint returned invalid JSON.");
  }
}

async function getRecentAnalytics(token, accountId, platform, fromDate, toDate) {
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const query = new URLSearchParams({
      platform,
      accountId,
      fromDate,
      toDate,
      limit: String(PAGE_SIZE),
      page: String(page),
      sortBy: "date",
      order: "desc",
    });
    const payload = await getJson(`/analytics?${query}`, token);
    const pageRows = extractRows(payload);
    rows.push(...pageRows);
    const paging = payload?.pagination ?? payload?.data?.pagination ?? payload?.meta ?? {};
    const totalPages = Number(paging.totalPages ?? paging.pages ?? payload?.totalPages ?? 0);
    const hasMore = paging.hasMore ?? paging.hasNextPage ?? payload?.hasMore;
    if (pageRows.length < PAGE_SIZE || hasMore === false || (totalPages && page >= totalPages)) break;
  }
  return rows;
}

async function readSafely(operation) {
  try {
    return { data: await operation(), error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

function analyticsSummary(rows) {
  const published = rows.map(row => row.publishedAt ?? row.platformAnalytics?.[0]?.publishedAt)
    .filter(value => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const updated = rows.map(row => row.analytics?.lastUpdated ?? row.lastUpdated ??
      row.platformAnalytics?.[0]?.analytics?.lastUpdated)
    .filter(value => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const statuses = rows.map(row => row.syncStatus ?? row.source?.syncStatus ??
    row.platformAnalytics?.find(item => item.syncStatus)?.syncStatus).filter(Boolean);
  const syncStatusCounts = Object.fromEntries([...new Set(statuses)].map(status => [
    status,
    statuses.filter(value => value === status).length,
  ]));
  return {
    postCount: rows.length,
    syncedPostCount: statuses.length ? (syncStatusCounts.synced ?? 0) : null,
    syncStatusKnownPostCount: statuses.length,
    syncStatusCounts,
    latestPublishedAt: published[0] ?? null,
    latestMetricUpdatedAt: updated[0] ?? null,
  };
}

function targetSlotSummary(slots, targetDate, timezone) {
  const targetDay = localWeekday(targetDate, timezone);
  const allCandidates = slots.map(slot => {
    const local = utcSlotToLocal(slot, timezone);
    if (!local) return null;
    return {
      targetLocalDate: targetDate,
      targetLocalWeekday: targetDay,
      localWeekday: local.localWeekday,
      localTime: local.localTime,
      sourceDayOfWeekUtc: slot.day_of_week ?? slot.dayofweek,
      sourceHourUtc: slot.hour,
      avgEngagement: Number(slot.avg_engagement),
      postCount: Number(slot.post_count),
    };
  }).filter(candidate => candidate &&
    Number.isFinite(candidate.avgEngagement) && Number.isFinite(candidate.postCount));
  const candidates = allCandidates.filter(candidate => candidate.localWeekday === targetDay);
  candidates.sort((a, b) => b.avgEngagement - a.avgEngagement || b.postCount - a.postCount);
  const supported = candidates.filter(candidate => candidate.postCount >= 3);
  const chosen = supported[0] ?? candidates[0] ?? null;
  const byHour = new Map();
  for (const candidate of allCandidates) {
    const total = byHour.get(candidate.localTime) ?? { engagementTotal: 0, postCount: 0, weekdays: new Set() };
    total.engagementTotal += candidate.avgEngagement * candidate.postCount;
    total.postCount += candidate.postCount;
    total.weekdays.add(candidate.localWeekday);
    byHour.set(candidate.localTime, total);
  }
  const hourOfDayCandidates = [...byHour.entries()].map(([localTime, data]) => ({
    localTime,
    avgEngagement: Number((data.engagementTotal / data.postCount).toFixed(2)),
    postCount: data.postCount,
    historicalWeekdays: [...data.weekdays].sort(),
  })).sort((a, b) => b.avgEngagement - a.avgEngagement || b.postCount - a.postCount);
  const chosenHour = chosen
    ? hourOfDayCandidates.find(item => item.localTime === chosen.localTime)
    : hourOfDayCandidates[0] ?? null;
  return {
    targetLocalDate: targetDate,
    timezone,
    method: "Zernio historical engagement grouped by UTC weekday/hour; slots converted to target local timezone.",
    recommendedSlot: chosen ? {
      ...chosen,
      confidence: chosen.postCount >= 3 ? "supported-by-at-least-3-posts" : "provisional-fewer-than-3-posts",
    } : null,
    recommendedTimeOfDay: chosenHour ? {
      ...chosenHour,
      basis: chosen ? "weekday-matched-slot" : "time-of-day-aggregated-across-weekdays",
      confidence: chosen && chosen.postCount >= 3 ? "supported-by-at-least-3-posts" :
        chosen ? "provisional-fewer-than-3-posts" : "provisional-weekday-has-no-matching-slot",
    } : null,
    candidateSlots: candidates.slice(0, 5),
    hourOfDayCandidates: hourOfDayCandidates.slice(0, 8),
  };
}

function onlineFollowerSummary(payload) {
  const body = payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
  const days = Array.isArray(body?.days) ? body.days : [];
  const totals = Array.from({ length: 24 }, (_, hour) => ({ hour, sum: 0, count: 0 }));
  for (const day of days) {
    for (const [hourKey, count] of Object.entries(day.hours ?? {})) {
      const hour = Number(hourKey);
      const value = Number(count);
      if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && Number.isFinite(value)) {
        totals[hour].sum += value;
        totals[hour].count++;
      }
    }
  }
  const averages = totals.filter(item => item.count).map(item => ({
    hour: item.hour,
    averageFollowersOnline: Number((item.sum / item.count).toFixed(2)),
    daysWithData: item.count,
  })).sort((a, b) => b.averageFollowersOnline - a.averageFollowersOnline);
  return {
    dayCount: days.length,
    newestDayEndTime: days.map(day => day.endTime).filter(Boolean).sort().at(-1) ?? null,
    topRawHourSlots: averages.slice(0, 5),
    timezone: "not-documented-by-Meta; raw hour keys preserved, so these are directional only",
  };
}

async function main() {
  assertTargetDate(TARGET_DATE);
  const calendar = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "content/calendar.json"), "utf8"));
  const timezone = calendar.timezone;
  if (!timezone) throw Error("Calendar timezone is missing.");
  const target = zernioTargetAccount(LANGUAGE, PLATFORM);
  const route = zernioRoute(LANGUAGE, process.env, PLATFORM);
  const now = new Date();
  const toDate = formatDate(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - LOOKBACK_DAYS);
  const fromDate = formatDate(from);
  const query = new URLSearchParams({ platform: PLATFORM, accountId: target.accountId, source: "all" });

  const bestTimeResult = await readSafely(() => getJson(`/analytics/best-time?${query}`, route.secret));
  const analyticsResult = await readSafely(() =>
    getRecentAnalytics(route.secret, target.accountId, PLATFORM, fromDate, toDate));
  const onlineResult = PLATFORM === "instagram"
    ? await readSafely(() =>
      getJson(`/analytics/instagram/online-followers?accountId=${encodeURIComponent(target.accountId)}`, route.secret))
    : { data: null, error: null };

  const slots = extractSlots(bestTimeResult.data);
  const recentRows = Array.isArray(analyticsResult.data) ? analyticsResult.data : [];
  const result = {
    schemaVersion: 1,
    status: slots.length ? "analytics-collected" : "best-time-data-unavailable",
    generatedAt: now.toISOString(),
    language: LANGUAGE,
    platform: PLATFORM,
    accountId: target.accountId,
    account: target.expectedUsername,
    timezone,
    targetDate: TARGET_DATE,
    lookback: { fromDate, toDate, days: LOOKBACK_DAYS },
    analytics: {
      status: analyticsResult.error ? "unavailable" : "ok",
      ...(analyticsResult.error ? { error: analyticsResult.error } : {}),
      ...analyticsSummary(recentRows),
    },
    bestTime: {
      source: "Zernio GET /v1/analytics/best-time",
      sourceTimezone: "UTC",
      status: bestTimeResult.error ? "unavailable" : slots.length ? "ok" : "empty",
      ...(bestTimeResult.error ? { error: bestTimeResult.error } : {}),
      slotCount: slots.length,
      ...targetSlotSummary(slots, TARGET_DATE, timezone),
    },
    ...(PLATFORM === "instagram" ? {
      onlineFollowers: {
        source: "Zernio GET /v1/analytics/instagram/online-followers",
        status: onlineResult.error ? "unavailable" : "ok",
        ...(onlineResult.error ? { error: onlineResult.error } : {}),
        ...onlineFollowerSummary(onlineResult.data),
      },
    } : {}),
    publicationPerformed: false,
  };

  const output = process.env.ZERNIO_TIME_OUTPUT;
  const json = JSON.stringify(result, null, 2) + "\n";
  if (output) await fs.writeFile(output, json, { mode: 0o600 });
  process.stdout.write(json);
}

main().catch(error => {
  // The exception messages intentionally exclude response bodies and credentials.
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
