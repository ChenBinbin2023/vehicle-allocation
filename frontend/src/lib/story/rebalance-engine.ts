import type {
  CampaignState,
  DailyDecision,
  DailyOrder,
  DailyPlan,
  SourceCandidate,
  VpcId,
} from "./types";

type CandidateDraft = Omit<SourceCandidate, "id" | "orderId">;

function occupiedVehicleIds(state: CampaignState): Set<string> {
  return new Set(
    state.dailyOperations.flatMap((plan) =>
      plan.executionTasks.flatMap((task) => task.vehicleIds),
    ),
  );
}

function ordersForDate(state: CampaignState, businessDate: string): DailyOrder[] {
  const exact = state.dailyOrders.filter((order) => order.businessDate === businessDate);
  if (exact.length) return exact;
  const day = Number(businessDate.replace("T+", ""));
  if (!Number.isFinite(day) || day < 4) return [];
  return state.dailyOrders
    .filter((order) => order.businessDate === "T+4")
    .map((order) => ({
      ...order,
      id: order.id.replace("DAY4-", `DAY${day}-`),
      businessDate,
    }));
}

function inventoryIds(
  state: CampaignState,
  vpcId: VpcId,
  model: string,
  quantity: number,
  excluded: Set<string>,
): string[] {
  if (!state.inventoryBaseline) return [];
  const vehicleById = new Map(
    state.vessel.vehicles.map((vehicle) => [vehicle.id, vehicle]),
  );
  return state.inventoryBaseline.positions
    .filter(
      (position) =>
        position.status === "available" &&
        position.vpcId === vpcId &&
        !excluded.has(position.vehicleId) &&
        vehicleById.get(position.vehicleId)?.model === model,
    )
    .slice(0, quantity)
    .map((position) => position.vehicleId);
}

function candidate(
  order: DailyOrder,
  suffix: string,
  draft: CandidateDraft,
): SourceCandidate {
  return { id: `SRC-${order.id}-${suffix}`, orderId: order.id, ...draft };
}

function enterpriseCandidates(
  state: CampaignState,
  order: DailyOrder,
): { candidates: SourceCandidate[]; decision: DailyDecision } {
  const used = new Set<string>();
  const build = (vpcId: VpcId, quantity: number) => {
    const ids = inventoryIds(state, vpcId, order.model, quantity, used);
    ids.forEach((id) => used.add(id));
    return ids;
  };
  const local = candidate(order, "RUH", {
    sourceType: "local_vpc",
    location: "RUH VPC",
    vehicleIds: build("RUH", 40),
    cost: 9_800,
    leadDays: 1,
    sourceCoverBefore: 22,
    sourceCoverAfter: 18,
    ownershipConfirmed: true,
    executable: true,
    profitImpact: -9_800,
    unmetConditions: [],
    reason: "先锁定利雅得本地库存，减少跨区里程",
  });
  const west = candidate(order, "JED", {
    sourceType: "nearby_vpc",
    location: "JED VPC",
    vehicleIds: build("JED", 24),
    cost: 16_800,
    leadDays: 2,
    sourceCoverBefore: 20,
    sourceCoverAfter: 17,
    ownershipConfirmed: true,
    executable: true,
    profitImpact: -16_800,
    unmetConditions: [],
    reason: "调用西部机动库存补齐企业大单",
  });
  const east = candidate(order, "DMM", {
    sourceType: "nearby_vpc",
    location: "DMM VPC",
    vehicleIds: build("DMM", 16),
    cost: 14_200,
    leadDays: 2,
    sourceCoverBefore: 14,
    sourceCoverAfter: 10,
    ownershipConfirmed: true,
    executable: true,
    profitImpact: -14_200,
    unmetConditions: [],
    reason: "仅动用达曼安全水位以上的 Hilux",
  });
  const candidates = [local, west, east];
  const expected = [40, 24, 16];
  const validated = candidates.map((item, index) => ({
    ...item,
    executable: item.vehicleIds.length === expected[index],
    unmetConditions: item.vehicleIds.length === expected[index]
      ? item.unmetConditions
      : [...item.unmetConditions, `车源不足：需 ${expected[index]} 台`],
  }));
  return {
    candidates: validated,
    decision: {
      id: `DEC-${order.id}`,
      orderId: order.id,
      recommendedCandidateIds: validated.map((item) => item.id),
      alternativeCandidateIds: [],
      status: "approval_required",
      rationale: "80 台企业订单采用 40+24+16 组合车源，保护单一 VPC 的安全水位。",
    },
  };
}

function premiumCandidates(state: CampaignState, order: DailyOrder) {
  const storeVehicleId = "STORE-LX-0001";
  const storeAvailable = !occupiedVehicleIds(state).has(storeVehicleId);
  const store = candidate(order, "STORE", {
    sourceType: "store",
    location: "利雅得旗舰店",
    vehicleIds: [storeVehicleId],
    cost: 2_800,
    leadDays: 0,
    sourceCoverBefore: 4,
    sourceCoverAfter: 3,
    ownershipConfirmed: true,
    executable: storeAvailable,
    profitImpact: -2_800,
    unmetConditions: storeAvailable ? [] : ["车辆已被历史运输任务占用"],
    reason: storeAvailable
      ? "同城门店低干扰调拨，调出后仍保留 3 天覆盖"
      : "该门店 VIN 已在过往经营日释放，不可再次调拨",
  });
  const dealer = candidate(order, "DEALER", {
    sourceType: "dealer",
    location: "利雅得授权车商",
    vehicleIds: ["DEALER-LX-0007"],
    cost: 5_500,
    leadDays: 1,
    sourceCoverBefore: 1,
    sourceCoverAfter: 0,
    ownershipConfirmed: false,
    executable: false,
    profitImpact: -5_500,
    unmetConditions: ["确认车辆权属", "确认回购价格", "完成付款授权"],
    reason: "车辆权属与回购条件尚未确认，不可执行",
  });
  return {
    candidates: [store, dealer],
    decision: {
      id: `DEC-${order.id}`,
      orderId: order.id,
      recommendedCandidateIds: [store.id],
      alternativeCandidateIds: [dealer.id],
      status: "approval_required" as const,
      rationale: "高利润 LX 优先同城低干扰调拨，授权车商仅作为待确权备选。",
    },
  };
}

function retailCandidates(state: CampaignState, order: DailyOrder) {
  const local = candidate(order, "DMM", {
    sourceType: "local_vpc",
    location: "DMM VPC",
    vehicleIds: inventoryIds(state, "DMM", order.model, 1, new Set()),
    cost: 950,
    leadDays: 1,
    sourceCoverBefore: 18,
    sourceCoverAfter: 17,
    ownershipConfirmed: true,
    executable: true,
    profitImpact: -950,
    unmetConditions: [],
    reason: "普通订单由本地 VPC 随既有短驳班次发运，不开亏损专车",
  });
  const nearby = candidate(order, "RUH", {
    sourceType: "nearby_vpc",
    location: "RUH VPC",
    vehicleIds: inventoryIds(state, "RUH", order.model, 1, new Set()),
    cost: 1_900,
    leadDays: 2,
    sourceCoverBefore: 26,
    sourceCoverAfter: 25,
    ownershipConfirmed: true,
    executable: true,
    profitImpact: -1_900,
    unmetConditions: [],
    reason: "本地缺车时从利雅得 VPC 补位",
  });
  return {
    candidates: [local, nearby],
    decision: {
      id: `DEC-${order.id}`,
      orderId: order.id,
      recommendedCandidateIds: [local.id],
      alternativeCandidateIds: [nearby.id],
      status: "proposed" as const,
      rationale: "本地库存优先，避免普通订单产生跨区专车成本。",
    },
  };
}

function remoteCandidates(state: CampaignState, order: DailyOrder) {
  const consolidated = candidate(order, "JED-CONSOLIDATED", {
    sourceType: "nearby_vpc",
    location: "JED VPC",
    vehicleIds: inventoryIds(state, "JED", order.model, order.quantity, new Set()),
    cost: 21_000,
    leadDays: 3,
    sourceCoverBefore: 20,
    sourceCoverAfter: 18,
    ownershipConfirmed: true,
    executable: true,
    profitImpact: -21_000,
    unmetConditions: [],
    reason: "并入塔布克西北周班拼单，满载一台 8 位板车",
  });
  const nextVessel = candidate(order, "NEXT-VESSEL", {
    sourceType: "next_vessel",
    location: "下一船在途资源",
    vehicleIds: [],
    cost: 0,
    leadDays: 18,
    sourceCoverBefore: 0,
    sourceCoverAfter: 0,
    ownershipConfirmed: true,
    executable: false,
    profitImpact: 0,
    unmetConditions: ["超出客户承诺期"],
    reason: "等待下一船将超过订单承诺期",
  });
  return {
    candidates: [consolidated, nextVessel],
    decision: {
      id: `DEC-${order.id}`,
      orderId: order.id,
      recommendedCandidateIds: [consolidated.id],
      alternativeCandidateIds: [nextVessel.id],
      status: "proposed" as const,
      rationale: "8 台偏远地区订单与西北周班拼单，避免零散发运。",
    },
  };
}

export function rebalanceDailyOrders(
  state: CampaignState,
  businessDate: string,
): DailyPlan {
  const orders = ordersForDate(state, businessDate);
  if (!state.inventoryBaseline) {
    return {
      id: `DAILY-${businessDate}`,
      businessDate,
      orders,
      candidates: [],
      decisions: [],
      executionTasks: [],
      status: "draft",
    };
  }
  const groups = orders.map((order) => {
    if (order.type === "enterprise") return enterpriseCandidates(state, order);
    if (order.type === "premium") return premiumCandidates(state, order);
    if (order.type === "remote") return remoteCandidates(state, order);
    return retailCandidates(state, order);
  });
  return {
    id: `DAILY-${businessDate}`,
    businessDate,
    orders,
    candidates: groups.flatMap((group) => group.candidates),
    decisions: groups.map((group) => group.decision),
    executionTasks: [],
    status: "ready",
  };
}

export function approveDailyDecision(
  state: CampaignState,
  decisionId: string,
): CampaignState {
  const planIndex = state.dailyOperations.findIndex((plan) =>
    plan.decisions.some((decision) => decision.id === decisionId),
  );
  if (planIndex < 0) return state;
  const plan = state.dailyOperations[planIndex];
  const decision = plan.decisions.find((item) => item.id === decisionId);
  const order = plan.orders.find((item) => item.id === decision?.orderId);
  if (!decision || !order || decision.status === "approved") return state;
  const selected = decision.recommendedCandidateIds.map((candidateId) =>
    plan.candidates.find((candidate) => candidate.id === candidateId),
  );
  if (selected.some((item) => !item || !item.executable || !item.ownershipConfirmed)) {
    return state;
  }
  const vehicleIds = selected.flatMap((item) => item!.vehicleIds);
  if (vehicleIds.length !== order.quantity || new Set(vehicleIds).size !== vehicleIds.length) {
    return state;
  }
  const occupied = occupiedVehicleIds(state);
  if (vehicleIds.some((vehicleId) => occupied.has(vehicleId))) return state;
  const available = new Set(
    state.inventoryBaseline?.positions
      .filter((position) => position.status === "available")
      .map((position) => position.vehicleId) ?? [],
  );
  const vpcVehicleIds = selected
    .filter((item) => item!.sourceType === "local_vpc" || item!.sourceType === "nearby_vpc")
    .flatMap((item) => item!.vehicleIds);
  if (vpcVehicleIds.some((vehicleId) => !available.has(vehicleId))) return state;
  const lockedVehicleIds = new Set(vehicleIds);
  const executionTasks = selected.map((candidateItem) => ({
    id: `TASK-${decisionId}-${candidateItem!.id}`,
    decisionId,
    orderId: decision.orderId,
    sourceCandidateId: candidateItem!.id,
    vehicleIds: [...candidateItem!.vehicleIds],
    status: "released" as const,
  }));
  const updatedPlan: DailyPlan = {
    ...plan,
    status: "executing",
    executionTasks: [...plan.executionTasks, ...executionTasks],
    decisions: plan.decisions.map((item) =>
      item.id === decisionId ? { ...item, status: "approved" } : item,
    ),
  };
  const dailyOperations = state.dailyOperations.map((item, index) =>
    index === planIndex ? updatedPlan : item,
  );
  return {
    ...state,
    version: state.version + 1,
    dailyOperations,
    inventoryBaseline: state.inventoryBaseline
      ? {
          ...state.inventoryBaseline,
          positions: state.inventoryBaseline.positions.map((position) =>
            lockedVehicleIds.has(position.vehicleId)
              ? { ...position, status: "locked" as const }
              : position,
          ),
        }
      : null,
    auditTrail: [
      ...state.auditTrail,
      {
        id: `AUDIT-${decisionId}`,
        at: plan.businessDate,
        action: "approve_daily_decision",
        detail: `已批准调拨决策 ${decisionId}`,
      },
    ],
  };
}
