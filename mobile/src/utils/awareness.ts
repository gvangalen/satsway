import { AWARENESS_CONTENT_POOL, FEATURE_FLAGS, SPONSORS } from "../config";
import type { AwarenessContent, Screen, Sponsor } from "../types";
import { getBestPerformingItem } from "./analytics";

const SESSION_OFFSET = Math.floor(Math.random() * AWARENESS_CONTENT_POOL.length);
const EXPLORATION_RATE = 0.2;
const screenSelections: Partial<Record<Screen, AwarenessContent>> = {};

function hashKey(key: string) {
  return key.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function getRotatedItem(items: AwarenessContent[], screen: Screen) {
  const index = (SESSION_OFFSET + hashKey(screen)) % items.length;
  return items[index];
}

function getRandomItem(items: AwarenessContent[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function getSmartAwarenessItem(items: AwarenessContent[], screen: Screen) {
  if (!FEATURE_FLAGS.autoOptimizeAwareness) {
    return getRotatedItem(items, screen);
  }

  const shouldExplore = Math.random() < EXPLORATION_RATE;

  if (shouldExplore) {
    return getRandomItem(items);
  }

  return getBestPerformingItem(items) ?? getRotatedItem(items, screen);
}

export function getAwarenessContent(screen: Screen): AwarenessContent | null {
  if (!FEATURE_FLAGS.educationHints || AWARENESS_CONTENT_POOL.length === 0) {
    return null;
  }

  if (!screenSelections[screen]) {
    screenSelections[screen] = getSmartAwarenessItem(AWARENESS_CONTENT_POOL, screen);
  }

  return screenSelections[screen] ?? null;
}

export function getSponsorForScreen(screen: Screen): Sponsor | null {
  if (!FEATURE_FLAGS.sponsorLayer || SPONSORS.length === 0) {
    return null;
  }

  const index = (SESSION_OFFSET + hashKey(`${screen}:sponsor`)) % SPONSORS.length;
  return SPONSORS[index];
}
