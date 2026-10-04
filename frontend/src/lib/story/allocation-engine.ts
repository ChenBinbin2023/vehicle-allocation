import type {
  AllocationAssignment,
  AllocationInput,
  AllocationPlan,
  CampaignState,
  DemandCategory,
  ValidationIssue,
  VehicleUnit,
  VpcId,
} from "./types";

type DestinationRule = {
  quantity: number;
  destination: string;
  targetVpc?: VpcId;
};

const destinations: Record<DemandCategory, DestinationRule[]> = {
  enterprise: [
    { quantity: 40, destination: "吉达企业交付中心" },
    { quantity: 80, destination: "利雅得企业交付中心" },
    { quantity: 120, destination: "东部企业交付中心" },
  ],
  retail: [
    { quantity: 70, destination: "西部客户交付门店" },
    { quantity: 20, destination: "利雅得客户交付门店" },
    { quantity: 170, destination: "东部客户交付门店" },
    { quantity: 30, destination: "中东部过渡带门店" },
  ],
  premium: [
    { quantity: 10, destination: "西部高价值客户交付点" },
    { quantity: 70, destination: "东部高价值客户交付点" },
    { quantity: 10, destination: "中东部高价值客户交付点" },
  ],
  replenishment: [
    { quantity: 300, destination: "吉达 VPC", targetVpc: "JED" },
    { quantity: 300, destination: "利雅得 VPC", targetVpc: "RUH" },
    {
      quantity: 80,
      destination: "中东部经利雅得短驳",
      targetVpc: "RUH",
    },
    { quantity: 100, destination: "达曼 VPC 安全库存", targetVpc: "DMM" },
  ],
  mobile: [
    { quantity: 60, destination: "吉达机动库存", targetVpc: "JED" },
    { quantity: 200, destination: "利雅得机动库存", targetVpc: "RUH" },
    {
      quantity: 40,
      destination: "中东部经利雅得机动库存",
      targetVpc: "RUH",
    },
  ],
  contingency: [
    { quantity: 40, destination: "吉达异常缓冲", targetVpc: "JED" },
    { quantity: 50, destination: "利雅得异常缓冲", targetVpc: "RUH" },
    {
      quantity: 10,
      destination: "中东部经利雅得异常缓冲",
      targetVpc: "RUH",
    },
  ],
};

const demandByCategory: Record<DemandCategory, string> = {
  enterprise: "DEM-ENTERPRISE",
  retail: "DEM-RETAIL",
  premium: "DEM-PREMIUM",
  replenishment: "DEM-REPLENISHMENT",
  mobile: "DEM-MOBILE",
  contingency: "DEM-CONTINGENCY",
};

function assignmentsForCategory(
  vehicles: VehicleUnit[],
  category: DemandCategory,
): AllocationAssignment[] {
  const selected = vehicles.filter(
    (vehicle) => vehicle.demandCategory === category,
  );
  const result: AllocationAssignment[] = [];
  let offset = 0;
  for (const rule of destinations[category]) {
    for (const vehicle of selected.slice(offset, offset + rule.quantity)) {
      result.push({
        vehicleId: vehicle.id,
        demandId: demandByCategory[category],
        pool: vehicle.pool,
        destination: rule.destination,
        targetVpc: rule.targetVpc,
        reason:
          vehicle.pool === "reserved"
            ? "保护已确认订单与客户承诺"
            : "补齐区域安全库存并保留全国机动能力",
      });
    }
    offset += rule.quantity;
  }
  return result;
}

export function validateAllocation(plan: AllocationPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = plan.assignments.map((assignment) => assignment.vehicleId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) {
    issues.push({
      id: "duplicate-vin",
      severity: "blocking",
      message: "同一 VIN 被多个需求占用",
      vehicleIds: [...new Set(duplicates)],
    });
  }
  if (plan.assignments.length !== 1800) {
    issues.push({
      id: "allocation-conservation",
      severity: "blocking",
      message: `分车数量为 ${plan.assignments.length}，必须等于 1,800`,
    });
  }
  if (plan.assignments.some((assignment) => !assignment.demandId)) {
    issues.push({
      id: "missing-demand",
      severity: "blocking",
      message: "存在没有需求归属的车辆",
    });
  }
  return issues;
}

export function allocateVessel(
  state: CampaignState,
  input: AllocationInput = {},
): AllocationPlan {
  let assignments = (
    [
      "enterprise",
      "retail",
      "premium",
      "replenishment",
      "mobile",
      "contingency",
    ] as DemandCategory[]
  ).flatMap((category) =>
    assignmentsForCategory(state.vessel.vehicles, category),
  );
  const desiredDammam = Math.max(
    80,
    Math.min(
      160,
      input.dammamSafetyStock ?? state.planningParameters.dammamSafetyStock,
    ),
  );
  const delta = desiredDammam - 100;
  if (delta > 0) {
    const move = new Set(
      assignments
        .filter(
          (item) =>
            item.demandId === "DEM-REPLENISHMENT" &&
            item.destination === "利雅得 VPC",
        )
        .slice(0, delta)
        .map((item) => item.vehicleId),
    );
    assignments = assignments.map((item) =>
      move.has(item.vehicleId)
        ? { ...item, destination: "达曼 VPC 安全库存", targetVpc: "DMM" }
        : item,
    );
  } else if (delta < 0) {
    const move = new Set(
      assignments
        .filter((item) => item.targetVpc === "DMM")
        .slice(0, -delta)
        .map((item) => item.vehicleId),
    );
    assignments = assignments.map((item) =>
      move.has(item.vehicleId)
        ? { ...item, destination: "利雅得 VPC", targetVpc: "RUH" }
        : item,
    );
  }
  const draft: AllocationPlan = {
    id: `ALLOC-${state.version}`,
    version: state.version,
    createdAt: "T-10",
    assignments,
    issues: [],
    status: "ready",
  };
  const issues = validateAllocation(draft);
  return {
    ...draft,
    issues,
    status: issues.some((issue) => issue.severity === "blocking")
      ? "blocked"
      : "ready",
  };
}
