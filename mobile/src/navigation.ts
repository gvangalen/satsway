import type { NavigatorScreenParams } from "@react-navigation/native";

import type { Screen, TabScreen } from "./types";

export type RootStackParamList = {
  tabs: NavigatorScreenParams<TabParamList>;
  request: { requestId?: string } | undefined;
  pay: { requestId?: string; shareId?: string } | undefined;
};

export type TabParamList = {
  home: undefined;
  create: undefined;
  scan: undefined;
  requests: undefined;
  wallet: undefined;
};

export const appRoutes = ["home", "create", "request", "pay", "scan", "requests", "wallet"] as const;
export const tabRoutes = ["home", "create", "scan", "requests", "wallet"] as const;

export function isAppRoute(routeName: string | undefined): routeName is Screen {
  return appRoutes.includes(routeName as Screen);
}

export function isTabRoute(routeName: string | undefined): routeName is TabScreen {
  return tabRoutes.includes(routeName as TabScreen);
}
