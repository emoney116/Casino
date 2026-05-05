import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.example.casino",
  appName: "Casino Prototype",
  webDir: "dist",
  backgroundColor: "#0e1118",
  server: {
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
