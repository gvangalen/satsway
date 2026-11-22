import { Text, View } from "react-native";

import { FEATURE_FLAGS } from "../config";
import { styles } from "../styles";

export function AnalyticsChart({ data }: { data: Record<string, number> }) {
  if (!FEATURE_FLAGS.analyticsCharts) {
    return null;
  }

  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, value]) => value));

  if (entries.length === 0) {
    return <Text style={styles.analyticsEmpty}>Nog geen events.</Text>;
  }

  return (
    <View style={styles.analyticsChart}>
      {entries.map(([label, value]) => (
        <View key={label} style={styles.analyticsBarRow}>
          <View style={styles.analyticsBarLabelRow}>
            <Text style={styles.analyticsBarLabel} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.analyticsBarValue}>{value}</Text>
          </View>
          <View style={styles.analyticsBarTrack}>
            <View style={[styles.analyticsBarFill, { width: `${Math.max(8, (value / max) * 100)}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}
