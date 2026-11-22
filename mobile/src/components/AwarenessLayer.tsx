import { useEffect, useRef } from "react";
import { Text, View } from "react-native";

import { FEATURE_FLAGS } from "../config";
import { styles } from "../styles";
import type { Screen, Sponsor } from "../types";
import { track } from "../utils/analytics";

export function BackgroundBrandingLayer({ screen }: { screen: Screen }) {
  if (!FEATURE_FLAGS.sponsorLayer) {
    return null;
  }

  const isPay = screen === "pay";

  return (
    <View style={[styles.awarenessBackground, isPay && styles.awarenessBackgroundDark]} pointerEvents="none">
      <View style={styles.awarenessOrbPrimary} />
      <View style={styles.awarenessOrbSecondary} />
      <View style={styles.awarenessGrid}>
        {Array.from({ length: 16 }).map((_, index) => (
          <View key={`awareness-dot-${index}`} style={styles.awarenessDot} />
        ))}
      </View>
      <View style={styles.awarenessLine} />
    </View>
  );
}

export function SponsorLabel({
  id,
  screen,
  sponsor,
  variant,
}: {
  id?: string;
  screen: Screen;
  sponsor: Sponsor | null;
  variant?: string;
}) {
  const hasLogged = useRef(false);

  useEffect(() => {
    if (hasLogged.current || !sponsor || !FEATURE_FLAGS.sponsorLayer) {
      return;
    }

    hasLogged.current = true;
    track("awareness_view", {
      type: "sponsor",
      id: id ?? sponsor.id,
      screen,
      variant,
    });
  }, [id, screen, sponsor, variant]);

  if (!sponsor || !FEATURE_FLAGS.sponsorLayer) {
    return null;
  }

  return (
    <View style={styles.sponsorLabel}>
      <Text style={styles.sponsorLabelText}>Sponsored • {sponsor.name}</Text>
    </View>
  );
}
