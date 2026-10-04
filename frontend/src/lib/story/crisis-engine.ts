import type { CampaignState, CrisisAnalysis } from "./types";

export function analyzeCrisis(state: CampaignState): CrisisAnalysis {
  const reservedQuantity = state.vessel.vehicles.filter(
    (vehicle) => vehicle.pool === "reserved",
  ).length;
  return {
    analyzedAt: "T-14",
    dammamPortAvailable: false,
    vesselQuantity: state.vessel.vehicles.length,
    reservedQuantity,
    inventoryQuantity: state.vessel.vehicles.length - reservedQuantity,
    eastboundPressure: 630,
    risks: [
      {
        id: "legacy-detour",
        label: "沿用达曼母库会产生长距离绕行与重复装卸",
        severity: "high",
      },
      {
        id: "east-capacity",
        label: "吉达至中东部方向的共享板车成为主要瓶颈",
        severity: "high",
      },
      {
        id: "port-release",
        label: "1,800 台集中入港使清关和 PDI 释放节奏承压",
        severity: "medium",
      },
    ],
    comparison: {
      legacy: [
        "东部车辆默认进入达曼 VPC",
        "中东部订单可能从达曼向西折返",
        "订单车与补货车共用固定区域规则",
      ],
      optimized: [
        "明确东部订单从吉达穿透直达",
        "利雅得承担中轴截流和全国机动库存",
        "达曼只接收可证明需要的东部安全库存",
      ],
    },
  };
}
