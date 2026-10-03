import { hongKongDay } from '../repositories/galleryAnalyticsRepository.js';

function galleryOverview(gallery, toGalleryResponse) {
  const response = toGalleryResponse(gallery);
  delete response.sceneJson;
  return response;
}

export function artworkItems(gallery) {
  try {
    const items = JSON.parse(gallery.scene_json)?.items;
    return Array.isArray(items) ? items.filter((item) => item?.id && ['painting', 'sculpture'].includes(item.type)) : [];
  } catch { return []; }
}

export function analyticsPeriod(range = '30d', now = new Date()) {
  const to = hongKongDay(now);
  const count = Number(range.slice(0, -1));
  const from = new Date(Date.parse(`${to}T00:00:00+08:00`) - (count - 1) * 86400000).toISOString();
  return { range, from, to: now.toISOString(), timeZone: 'Asia/Hong_Kong' };
}

export function buildGalleryAnalytics({ galleries, comments, visits, period, galleryId, measurementStartedAt, toGalleryResponse }) {
  const availableGalleries = galleries.map(({ id, title }) => ({ id, title }));
  const selected = galleries.filter((g) => !galleryId || g.id === galleryId);
  const firstDay = hongKongDay(period.from);
  const lastDay = hongKongDay(period.to);
  const daily = new Map();
  for (let at = Date.parse(period.from); at <= Date.parse(period.to); at += 86400000) {
    daily.set(hongKongDay(at), { date: hongKongDay(at), sessions: new Set(), visitors: new Set(), totalDwellSeconds: 0 });
  }
  const stats = new Map(selected.map((g) => [g.id, { ...galleryOverview(g, toGalleryResponse), itemCount: artworkItems(g).length, commentCount: 0, visitors: new Set(), sessions: new Set(), totalDwellSeconds: 0, latestActivityAt: null }]));
  const items = new Map(selected.flatMap((g) => artworkItems(g).map((i) => [`${g.id}:${i.id}`, { galleryId: g.id, galleryTitle: g.title, itemId: i.id, title: i.title || i.name || i.id, artist: i.artist || null, type: i.type, commentCount: 0, visitors: new Set(), dwellSeconds: 0, latestActivityAt: null }])));
  const allVisitors = new Set();
  const allSessions = new Set();
  for (const visit of visits) {
    const stat = stats.get(visit.gallery_id);
    if (!stat) continue;
    for (const [day, bucket] of Object.entries(JSON.parse(visit.days_json))) {
      if (day < firstDay || day > lastDay) continue;
      const sessionKey = `${visit.gallery_id}:${visit.session_id}`;
      stat.visitors.add(visit.visitor_id); stat.sessions.add(sessionKey);
      allVisitors.add(visit.visitor_id); allSessions.add(sessionKey);
      stat.totalDwellSeconds += bucket.seconds;
      stat.latestActivityAt = [stat.latestActivityAt, visit.updated_at].filter(Boolean).sort().at(-1);
      const dailyStat = daily.get(day);
      dailyStat.visitors.add(visit.visitor_id); dailyStat.sessions.add(sessionKey); dailyStat.totalDwellSeconds += bucket.seconds;
      for (const [id, seconds] of Object.entries(bucket.items)) {
        const item = items.get(`${visit.gallery_id}:${id}`);
        if (!item || seconds <= 0) continue;
        item.visitors.add(visit.visitor_id); item.dwellSeconds += seconds; item.latestActivityAt = stat.latestActivityAt;
      }
    }
  }
  const filteredComments = comments.filter((c) => stats.has(c.gallery_id) && Date.parse(c.created_at) >= Date.parse(period.from) && Date.parse(c.created_at) <= Date.parse(period.to));
  for (const c of filteredComments) {
    stats.get(c.gallery_id).commentCount++;
    const item = items.get(`${c.gallery_id}:${c.item_id}`);
    if (item) item.commentCount++;
  }
  const galleryResponse = [...stats.values()].map(({ visitors, sessions, ...g }) => ({ ...g, visitorCount: visitors.size, visitCount: sessions.size, engagedCount: 0, totalDwellSeconds: Math.round(g.totalDwellSeconds), popularityScore: visitors.size * 3 + g.commentCount * 4 + Math.min(g.totalDwellSeconds / 60, 50) })).sort((a, b) => b.visitCount - a.visitCount || b.totalDwellSeconds - a.totalDwellSeconds);
  const itemResponse = [...items.values()].map(({ visitors, ...i }) => ({ ...i, visitorCount: visitors.size, engagedCount: 0, dwellSeconds: Math.round(i.dwellSeconds), popularityScore: visitors.size * 3 + i.commentCount * 4 + Math.min(i.dwellSeconds / 60, 25) })).sort((a, b) => b.dwellSeconds - a.dwellSeconds || b.visitorCount - a.visitorCount).slice(0, 30);
  const totalDwellSeconds = Math.round([...stats.values()].reduce((sum, g) => sum + g.totalDwellSeconds, 0));
  return {
    summary: { totalGalleries: selected.length, publishedGalleries: selected.filter((g) => g.is_published).length, totalItems: galleryResponse.reduce((s, g) => s + g.itemCount, 0), totalComments: filteredComments.length, totalVisitors: allVisitors.size, totalVisits: allSessions.size, totalDwellSeconds, averageVisitSeconds: allSessions.size ? Math.round(totalDwellSeconds / allSessions.size) : 0, topGallery: galleryResponse[0] || null },
    galleries: galleryResponse, items: itemResponse,
    comments: filteredComments.slice(0, 100).map((c) => ({ id: c.id, galleryId: c.gallery_id, galleryTitle: stats.get(c.gallery_id).title, itemId: c.item_id, itemTitle: items.get(`${c.gallery_id}:${c.item_id}`)?.title || c.item_id, userName: c.user_name, content: c.content, createdAt: c.created_at })),
    availableGalleries, period, measurementStartedAt,
    daily: [...daily.values()].map(({ sessions, visitors, ...d }) => ({ ...d, visitCount: sessions.size, visitorCount: visitors.size, totalDwellSeconds: Math.round(d.totalDwellSeconds) })),
  };
}
