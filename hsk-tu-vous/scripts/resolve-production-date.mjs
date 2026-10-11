/**
 * Resolve the user's "today's video" request within the calendar's timezone.
 *
 * This is the sole exception to the strict exact-date policy: when today's
 * slot is absent, choose the nearest upcoming *planned* calendar item.
 * Explicit YYYY-MM-DD requests must continue using exact-date lookup.
 */
export function resolveTodayVideo(calendar, now = new Date(), { confirmedPublishedEpisodeIds = new Set() } = {}) {
  const timeZone = calendar?.timezone;
  if (typeof timeZone !== "string" || !timeZone) {
    throw new Error("Calendar timezone is missing.");
  }
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) {
    throw new Error("Invalid current date.");
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const getPart = (name) => parts.find((part) => part.type === name)?.value;
  const today = [getPart("year"), getPart("month"), getPart("day")].join("-");
  const all = calendar?.items;
  if (!Array.isArray(all)) throw new Error("Calendar items are missing.");
  const exact = all.find((item) => item.date === today);
  if (exact && exact.status === "planned" && !confirmedPublishedEpisodeIds.has(exact.id)) return {
    requestedDate: today,
    selectedDate: exact.date,
    episodeId: exact.id,
    topic: exact.topic,
    selection: "today",
    timezone: timeZone,
  };
  const future = all
    .filter((item) => typeof item.date === "string" && item.date > today && item.status === "planned" && !confirmedPublishedEpisodeIds.has(item.id))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!future) {
    throw new Error(
      `No eligible unpublished video is scheduled for ${today}, and no upcoming planned video exists. Do not select a past date or create a new episode.`,
    );
  }
  return {
    requestedDate: today,
    selectedDate: future.date,
    episodeId: future.id,
    topic: future.topic,
    selection: "next-planned",
    skippedPublished: all.filter(item=>item.date >= today && confirmedPublishedEpisodeIds.has(item.id)).map(item=>({date:item.date,episodeId:item.id})),
    timezone: timeZone,
  };
}
