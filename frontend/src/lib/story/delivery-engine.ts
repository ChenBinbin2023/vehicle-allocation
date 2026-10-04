import type {
  AllocationAssignment,
  AllocationPlan,
  CampaignState,
  DeliveryAssignment,
  DeliveryBatch,
  DeliveryInput,
  DeliveryPlan,
  RouteId,
  ValidationIssue,
} from "./types";

const routeTiming: Record<
  RouteId,
  { releaseDay: number; arrivalDay: number; handlingCount: number; cost: number }
> = {
  west: { releaseDay: 0, arrivalDay: 1, handlingCount: 1, cost: 1_850 },
  riyadh: { releaseDay: 0, arrivalDay: 2, handlingCount: 1, cost: 4_900 },
  eastDirect: {
    releaseDay: 0,
    arrivalDay: 3,
    handlingCount: 1,
    cost: 7_300,
  },
  riyadhIntercept: {
    releaseDay: 0,
    arrivalDay: 3,
    handlingCount: 2,
    cost: 5_800,
  },
  dammamSafety: {
    releaseDay: 1,
    arrivalDay: 3,
    handlingCount: 2,
    cost: 7_600,
  },
};

const defaultCapacity: Record<RouteId, number> = {
  west: 520,
  riyadh: 650,
  eastDirect: 360,
  riyadhIntercept: 170,
  dammamSafety: 100,
};

function routeFor(assignment: AllocationAssignment): RouteId {
  if (assignment.targetVpc === "DMM") return "dammamSafety";
  if (assignment.destination.startsWith("中东部")) return "riyadhIntercept";
  if (assignment.destination.startsWith("东部")) return "eastDirect";
  if (
    assignment.targetVpc === "JED" ||
    assignment.destination.includes("吉达") ||
    assignment.destination.startsWith("西部")
  )
    return "west";
  return "riyadh";
}

function createBatches(assignments: DeliveryAssignment[]): DeliveryBatch[] {
  const batches: DeliveryBatch[] = [];
  for (const route of Object.keys(routeTiming) as RouteId[]) {
    const routeAssignments = assignments.filter((item) => item.route === route);
    for (let offset = 0; offset < routeAssignments.length; offset += 8) {
      const batchNumber = offset / 8 + 1;
      const timing = routeTiming[route];
      batches.push({
        id: `DEMO-TRUCK-${route}-${String(batchNumber).padStart(3, "0")}`,
        route,
        vehicleIds: routeAssignments
          .slice(offset, offset + 8)
          .map((item) => item.vehicleId),
        departDay: timing.releaseDay,
        arrivalDay: timing.arrivalDay,
        capacity: 8,
        cost: timing.cost,
        status: "planned",
      });
    }
  }
  return batches;
}

function adjustmentPriority(assignment: AllocationAssignment): number {
  if (assignment.pool === "reserved") return 100;
  if (assignment.demandId === "DEM-CONTINGENCY") return 0;
  if (assignment.demandId === "DEM-MOBILE") return 1;
  return 2;
}

function capacityIssues(
  allocation: AllocationPlan,
  delivery: DeliveryAssignment[],
  capacity: Record<RouteId, number>,
): ValidationIssue[] {
  const allocationByVin = new Map(
    allocation.assignments.map((item) => [item.vehicleId, item]),
  );
  const issues: ValidationIssue[] = [];
  for (const route of Object.keys(capacity) as RouteId[]) {
    const routeAssignments = delivery.filter((item) => item.route === route);
    const excess = routeAssignments.length - capacity[route];
    if (excess <= 0) continue;
    const affected = [...routeAssignments]
      .sort(
        (left, right) =>
          adjustmentPriority(allocationByVin.get(left.vehicleId)!) -
          adjustmentPriority(allocationByVin.get(right.vehicleId)!),
      )
      .slice(0, excess)
      .map((item) => item.vehicleId);
    issues.push({
      id: `route-capacity-${route}`,
      severity: "blocking",
      message: `${route} 路线容量缺口 ${excess} 台，已标记低优先库存待调整`,
      vehicleIds: affected,
    });
  }
  return issues;
}

export function validateDelivery(plan: DeliveryPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = plan.assignments.map((item) => item.vehicleId);
  if (ids.length !== 1800) {
    issues.push({
      id: "delivery-conservation",
      severity: "blocking",
      message: `运输计划包含 ${ids.length} 台，必须等于 1,800 台`,
    });
  }
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) {
    issues.push({
      id: "delivery-duplicate-vin",
      severity: "blocking",
      message: "同一 VIN 被安排到多个运输任务",
      vehicleIds: [...new Set(duplicates)],
    });
  }
  const batchIds = new Set(plan.batches.map((batch) => batch.id));
  const missingBatch = plan.assignments
    .filter((item) => !batchIds.has(item.batchId))
    .map((item) => item.vehicleId);
  if (missingBatch.length) {
    issues.push({
      id: "delivery-missing-batch",
      severity: "blocking",
      message: "存在未进入板车批次的车辆",
      vehicleIds: missingBatch,
    });
  }
  return issues;
}

export function planDelivery(
  state: CampaignState,
  input: DeliveryInput = {},
): DeliveryPlan {
  const allocation = state.allocation;
  if (!allocation) {
    return {
      id: `DELIVERY-${state.version}`,
      allocationId: "missing",
      createdAt: "T-7",
      assignments: [],
      batches: [],
      issues: [
        {
          id: "missing-allocation",
          severity: "blocking",
          message: "请先完成并确认船次分车计划",
        },
      ],
      status: "blocked",
    };
  }

  const provisional = allocation.assignments.map((item) => {
    const route = routeFor(item);
    const timing = routeTiming[route];
    return {
      vehicleId: item.vehicleId,
      route,
      batchId: "",
      releaseDay: timing.releaseDay,
      arrivalDay: timing.arrivalDay,
      handlingCount: timing.handlingCount,
    } satisfies DeliveryAssignment;
  });
  const batches = createBatches(provisional);
  const batchByVin = new Map(
    batches.flatMap((batch) =>
      batch.vehicleIds.map((vehicleId) => [vehicleId, batch.id] as const),
    ),
  );
  const assignments = provisional.map((item) => ({
    ...item,
    batchId: batchByVin.get(item.vehicleId) ?? "",
  }));
  const capacity = { ...defaultCapacity, ...input.routeCapacity };
  const draft: DeliveryPlan = {
    id: `DELIVERY-${state.version}`,
    allocationId: allocation.id,
    createdAt: "T-7",
    assignments,
    batches,
    issues: [],
    status: "ready",
  };
  const issues = [
    ...validateDelivery(draft),
    ...capacityIssues(allocation, assignments, capacity),
  ];
  return {
    ...draft,
    issues,
    status: issues.some((issue) => issue.severity === "blocking")
      ? "blocked"
      : "ready",
  };
}

export function markAllocationFromDelivery(
  plan: AllocationPlan,
  delivery: DeliveryPlan,
): AllocationPlan {
  const deliveryIssues = delivery.issues.filter(
    (issue) => issue.severity === "blocking",
  );
  return {
    ...plan,
    issues: [...plan.issues, ...deliveryIssues],
    status: deliveryIssues.length ? "blocked" : plan.status,
  };
}
