import { FEATURE_FLAGS } from "../config";

export type AnalyticsEvent = "awareness_view" | "awareness_interaction";

type AnalyticsPayload = {
  type: "education" | "sponsor";
  id: string;
  screen: string;
  variant?: string;
};

export type StoredEvent = {
  event: AnalyticsEvent;
  type: "education" | "sponsor";
  id: string;
  screen: string;
  variant: string;
  sessionId: string;
  timestamp: number;
};

const MAX_EVENTS = 100;
const MIN_VIEWS = 10;
const store: StoredEvent[] = [];
const queue: StoredEvent[] = [];
const sessionId = Math.random().toString(36).substring(7);

export function track(event: AnalyticsEvent, payload: AnalyticsPayload) {
  if (!FEATURE_FLAGS.analytics) {
    return;
  }

  const enriched: StoredEvent = {
    event,
    type: payload.type,
    id: payload.id,
    screen: payload.screen,
    variant: payload.variant || "default",
    sessionId,
    timestamp: Date.now(),
  };

  store.push(enriched);
  if (store.length > MAX_EVENTS) {
    store.shift();
  }

  if (FEATURE_FLAGS.analyticsQueue) {
    queue.push(enriched);
    if (queue.length > MAX_EVENTS) {
      queue.shift();
    }
  }

  console.log("[analytics]", enriched);
}

export function getAnalyticsInsights() {
  const insights = {
    total: store.length,
    views: 0,
    interactions: 0,
    ctr: 0,
    byScreen: {} as Record<string, number>,
    byItem: {} as Record<string, number>,
  };

  for (const event of store) {
    if (event.event === "awareness_view") {
      insights.views += 1;
    }

    if (event.event === "awareness_interaction") {
      insights.interactions += 1;
    }

    insights.byScreen[event.screen] = (insights.byScreen[event.screen] || 0) + 1;
    insights.byItem[event.id] = (insights.byItem[event.id] || 0) + 1;
  }

  insights.ctr = insights.views > 0 ? insights.interactions / insights.views : 0;
  return insights;
}

export function getCTRPerItem() {
  const stats: Record<string, { views: number; interactions: number }> = {};

  for (const event of store) {
    if (!stats[event.id]) {
      stats[event.id] = { views: 0, interactions: 0 };
    }

    if (event.event === "awareness_view") {
      stats[event.id].views += 1;
    }

    if (event.event === "awareness_interaction") {
      stats[event.id].interactions += 1;
    }
  }

  const ctr: Record<string, number> = {};

  for (const id in stats) {
    const { views, interactions } = stats[id];
    ctr[id] = views >= MIN_VIEWS ? interactions / views : 0;
  }

  return ctr;
}

export function getBestPerformingItem<T extends { id: string }>(items: T[]) {
  const ctrMap = getCTRPerItem();
  let bestItem: T | null = null;
  let bestScore = 0;

  for (const item of items) {
    const score = ctrMap[item.id] || 0;

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return bestItem;
}

export function getStoredAnalyticsEvents() {
  return [...store];
}

export function clearAnalytics() {
  store.length = 0;
  queue.length = 0;
  console.log("[analytics] cleared");
}

export function flushAnalytics() {
  console.log("Ready to send", queue.length);
}
