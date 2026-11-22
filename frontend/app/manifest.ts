import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Satsway",
    short_name: "Satsway",
    description: "Deel een betaalverzoek en kies hoe je ontvangt.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff7ed",
    theme_color: "#f7931a",
    icons: [{ src: "/satsway-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
