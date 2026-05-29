import type { VipTierId } from "./vipService";

export const vipBadgeSrcByTier: Record<VipTierId, string> = {
  none: new URL("../assets/vip/vip_none.png", import.meta.url).href,
  bronze: new URL("../assets/vip/vip_bronze.png", import.meta.url).href,
  silver: new URL("../assets/vip/vip_silver.png", import.meta.url).href,
  gold: new URL("../assets/vip/vip_gold.png", import.meta.url).href,
  platinum: new URL("../assets/vip/vip_platinum.png", import.meta.url).href,
  diamond: new URL("../assets/vip/vip_diamond.png", import.meta.url).href,
  "black-diamond": new URL("../assets/vip/vip_black_diamond.png", import.meta.url).href,
  onyx: new URL("../assets/vip/vip_onyx.png", import.meta.url).href,
  inferno: new URL("../assets/vip/vip_inferno.png", import.meta.url).href,
  "heater-elite": new URL("../assets/vip/vip_heater_elite.png", import.meta.url).href,
  legend: new URL("../assets/vip/vip_legend.png", import.meta.url).href,
};
