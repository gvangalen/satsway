import type { LinkingOptions } from "@react-navigation/native";

import type { RootStackParamList } from "./navigation";

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["satsway:///", "satsway://", "com.satsway.app:///", "com.satsway.app://"],
  config: {
    screens: {
      tabs: {
        screens: {
          home: "",
          create: "create",
          scan: "scan",
          requests: "requests",
          wallet: "wallet",
        },
      },
      request: "request/:requestId",
      pay: {
        path: "pay/:requestId/:shareId?",
        parse: {
          requestId: String,
          shareId: String,
        },
      },
    },
  },
};
