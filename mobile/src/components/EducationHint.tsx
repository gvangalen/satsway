import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";

import { BITCOIN_ORANGE } from "../config";
import { styles } from "../styles";
import type { AwarenessContent, Screen } from "../types";
import { track } from "../utils/analytics";

export function EducationHint({ content, screen }: { content: AwarenessContent | null; screen: Screen }) {
  const hasLogged = useRef(false);

  useEffect(() => {
    if (hasLogged.current || !content || content.type !== "education") {
      return;
    }

    hasLogged.current = true;
    track("awareness_view", {
      type: "education",
      id: content.id,
      screen,
      variant: content.variant,
    });
  }, [content, screen]);

  if (!content || content.type !== "education") {
    return null;
  }

  const accent = content.accent === "bitcoin" ? "₿" : content.accent === "lightning" ? "⚡" : "sat";
  const handlePress = () => {
    track("awareness_interaction", {
      type: "education",
      id: content.id,
      screen,
      variant: content.variant,
    });
  };

  return (
    <Pressable style={styles.educationHint} onPress={handlePress}>
      <View style={styles.educationHintIcon}>
        <Text style={[styles.educationHintIconText, content.accent === "bitcoin" && { color: BITCOIN_ORANGE }]}>
          {accent}
        </Text>
      </View>
      <View style={styles.educationHintCopy}>
        <Text style={styles.educationHintLabel}>{content.label}</Text>
        <Text style={styles.educationHintText}>{content.text}</Text>
      </View>
    </Pressable>
  );
}
