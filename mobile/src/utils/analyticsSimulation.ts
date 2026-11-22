import { FEATURE_FLAGS } from "../config";
import { track } from "./analytics";

export type SimulationScenario = "high_engagement" | "low_engagement" | "mixed";

const screens = ["home", "request", "pay", "wallet"];
const items = [
  { id: "edu-sats", type: "education" as const, variant: "A" },
  { id: "edu-global-payments", type: "education" as const, variant: "A" },
  { id: "edu-no-middleman", type: "education" as const, variant: "B" },
  { id: "sponsor-river", type: "sponsor" as const, variant: "A" },
  { id: "sponsor-strategy", type: "sponsor" as const, variant: "B" },
];

function randomItem() {
  return items[Math.floor(Math.random() * items.length)];
}

function randomScreen() {
  return screens[Math.floor(Math.random() * screens.length)];
}

function getInteractionChance(scenario: SimulationScenario) {
  if (scenario === "high_engagement") {
    return 0.3;
  }

  if (scenario === "mixed") {
    return 0.15;
  }

  return 0.05;
}

export function runSimulation(scenario: SimulationScenario) {
  if (!FEATURE_FLAGS.simulationMode) {
    return;
  }

  const iterations = 100;
  const interactChance = getInteractionChance(scenario);

  for (let index = 0; index < iterations; index += 1) {
    const item = randomItem();
    const screen = randomScreen();

    track("awareness_view", {
      type: item.type,
      id: item.id,
      screen,
      variant: item.variant,
    });

    if (Math.random() < interactChance) {
      track("awareness_interaction", {
        type: item.type,
        id: item.id,
        screen,
        variant: item.variant,
      });
    }
  }

  console.log("[simulation] finished:", scenario);
}
