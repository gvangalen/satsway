import { Pressable, Text, View } from "react-native";

import type { Poster, Screen, TabScreen } from "../types";
import { styles } from "../styles";

export function BottomTabs({ activeTab, onChange }: { activeTab: TabScreen; onChange: (tab: TabScreen) => void }) {
  const tabs: { key: TabScreen; label: string; icon: string }[] = [
    { key: "home", label: "Home", icon: "⌂" },
    { key: "create", label: "Sturen", icon: "+" },
    { key: "scan", label: "Scan", icon: "▣" },
    { key: "requests", label: "Ontvangen", icon: "↙" },
    { key: "wallet", label: "Wallet", icon: "₿" },
  ];

  return (
    <View style={styles.tabBarShell}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => onChange(tab.key)}
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function PosterSurface({ poster, compact = false }: { poster: Poster; compact?: boolean }) {
  const isBitcoin = poster.theme === "bitcoin";
  const isSponsor = poster.theme === "sponsor";

  return (
    <View
      style={[
        styles.posterSurface,
        compact && styles.posterSurfaceCompact,
        isBitcoin && styles.posterSurfaceBitcoin,
        isSponsor && styles.posterSurfaceSponsor,
      ]}
    >
      <View style={styles.posterGlowOne} />
      <View style={styles.posterGlowTwo} />
      <View style={styles.posterContent}>
        <View style={styles.posterTopRow}>
          <Text style={styles.posterLabel}>{poster.sponsor_name ?? "Satsway poster"}</Text>
          <View style={styles.posterBadge}>
            <Text style={styles.posterBadgeText}>{isSponsor ? "Ad" : "Info"}</Text>
          </View>
        </View>
        <Text style={[styles.posterTitle, compact && styles.posterTitleCompact]}>{poster.title}</Text>
        <Text style={[styles.posterText, compact && styles.posterTextCompact]}>{poster.text}</Text>
      </View>
      <View style={[styles.posterCoin, compact && styles.posterCoinCompact]}>
        <Text style={styles.posterCoinText}>₿</Text>
      </View>
    </View>
  );
}

export function FullPosterBackground({ poster }: { poster: Poster }) {
  return (
    <View style={styles.fullPosterBackground} pointerEvents="none">
      <View style={styles.fullPosterWash} />
      <View style={styles.fullPosterMoon} />
      <View style={styles.brandOrbLarge}>
        <Text style={styles.brandOrbText}>RIVER</Text>
      </View>
      <View style={styles.strategyMark}>
        <Text style={styles.strategyMarkText}>STRATEGY</Text>
      </View>
      <View style={styles.minerGrid}>
        {Array.from({ length: 12 }).map((_, index) => (
          <View key={`miner-dot-${index}`} style={styles.minerDot} />
        ))}
        <Text style={styles.minerGridText}>MINER</Text>
      </View>
      <View style={styles.brandOrbSmall}>
        <Text style={styles.brandOrbSmallText}>₿</Text>
      </View>
      <View style={styles.fullPosterCoin}>
        <Text style={styles.fullPosterCoinText}>₿</Text>
      </View>
      <View style={styles.fullPosterCopy}>
        <Text style={styles.fullPosterSponsor}>{poster.sponsor_name ?? "Satsway partner"}</Text>
      </View>
      <Text style={styles.fullPosterWatermark}>BITCOIN</Text>
    </View>
  );
}

export function BackHeader({ kicker, title, onBack, light = false }: { kicker: string; title: string; onBack: () => void; light?: boolean }) {
  return (
    <View style={styles.backHeader}>
      <Pressable style={[styles.backButton, light && styles.backButtonLight]} onPress={onBack}>
        <Text style={[styles.backButtonText, light && styles.backButtonTextLight]}>‹</Text>
      </Pressable>
      <View style={styles.backHeaderText}>
        <Text style={[styles.kicker, light && styles.lightText]}>{kicker}</Text>
        <Text style={[styles.headerTitle, light && styles.lightText]}>{title}</Text>
      </View>
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.primaryButton, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function QuickAction({
  label,
  icon,
  onPress,
  variant = "default",
}: {
  label: string;
  icon: string;
  onPress: () => void;
  variant?: "default" | "glass";
}) {
  return (
    <Pressable style={[styles.quickAction, variant === "glass" && styles.quickActionGlass]} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

export function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.stepperButton} onPress={onPress}>
      <Text style={styles.stepperButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Stat({ value, label, dark = false }: { value: string; label: string; dark?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, dark && styles.statValueDark]}>{value}</Text>
      <Text style={[styles.statLabel, dark && styles.statLabelDark]}>{label}</Text>
    </View>
  );
}

export function getActiveTab(screen: Screen): TabScreen | null {
  if (screen === "home" || screen === "create" || screen === "scan" || screen === "requests" || screen === "wallet") {
    return screen;
  }

  return null;
}
