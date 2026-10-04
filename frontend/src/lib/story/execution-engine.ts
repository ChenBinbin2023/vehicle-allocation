import type {
  CampaignState,
  ExecutionEvent,
  ExecutionTotals,
  InventoryBaseline,
  ValidationIssue,
  VehicleStatus,
} from "./types";

function addBlocker(
  state: CampaignState,
  event: ExecutionEvent,
  message: string,
): CampaignState {
  const blocker: ValidationIssue = {
    id: `execution-${event.id}`,
    severity: "blocking",
    message,
  };
  return {
    ...state,
    version: state.version + 1,
    arrivalExecution: {
      ...state.arrivalExecution,
      events: [...state.arrivalExecution.events, event],
      blockers: [...state.arrivalExecution.blockers, blocker],
    },
  };
}

function updateVehicles(
  state: CampaignState,
  vehicleIds: Set<string>,
  statusFor: (pool: "reserved" | "inventory") => VehicleStatus,
): CampaignState["vessel"]["vehicles"] {
  return state.vessel.vehicles.map((vehicle) =>
    vehicleIds.has(vehicle.id)
      ? { ...vehicle, status: statusFor(vehicle.pool) }
      : vehicle,
  );
}

export function applyExecutionEvent(
  state: CampaignState,
  event: ExecutionEvent,
): CampaignState {
  if (state.arrivalExecution.events.some((item) => item.id === event.id)) {
    return state;
  }
  if (!state.deliveryPlan) {
    return addBlocker(state, event, "缺少已确认的运输计划");
  }

  if (event.type === "arrive") {
    return {
      ...state,
      version: state.version + 1,
      phase: "arrival",
      vessel: {
        ...state.vessel,
        vehicles: state.vessel.vehicles.map((vehicle) =>
          vehicle.status === "at_sea"
            ? { ...vehicle, status: "customs" as const }
            : vehicle,
        ),
      },
      arrivalExecution: {
        ...state.arrivalExecution,
        vesselArrived: true,
        events: [...state.arrivalExecution.events, event],
      },
    };
  }

  if (!state.arrivalExecution.vesselArrived) {
    return addBlocker(state, event, "滚装船尚未到港，不能推进执行事件");
  }

  if (event.type === "clear" || event.type === "pdi") {
    const ids = new Set(event.vehicleIds);
    const requiredStatus = event.type === "clear" ? "customs" : "pdi";
    const nextStatus = event.type === "clear" ? "pdi" : "ready";
    const invalid = state.vessel.vehicles.filter(
      (vehicle) => ids.has(vehicle.id) && vehicle.status !== requiredStatus,
    );
    if (invalid.length) {
      return addBlocker(
        state,
        event,
        `${invalid.length} 台车辆未处于 ${requiredStatus} 状态`,
      );
    }
    return {
      ...state,
      version: state.version + 1,
      vessel: {
        ...state.vessel,
        vehicles: updateVehicles(state, ids, () => nextStatus),
      },
      arrivalExecution: {
        ...state.arrivalExecution,
        events: [...state.arrivalExecution.events, event],
      },
    };
  }

  if (!("batchId" in event)) {
    return addBlocker(state, event, "执行事件缺少板车批次");
  }
  const batchId = event.batchId;
  const batch = state.deliveryPlan.batches.find(
    (candidate) => candidate.id === batchId,
  );
  if (!batch) return addBlocker(state, event, "找不到对应的板车批次");
  const batchIds = new Set(batch.vehicleIds);

  if (event.type === "ship") {
    const notReady = state.vessel.vehicles.filter(
      (vehicle) => batchIds.has(vehicle.id) && vehicle.status !== "ready",
    );
    if (notReady.length) {
      return addBlocker(state, event, `${notReady.length} 台车辆尚未完成 PDI`);
    }
    return {
      ...state,
      version: state.version + 1,
      vessel: {
        ...state.vessel,
        vehicles: updateVehicles(state, batchIds, () => "in_transit"),
      },
      deliveryPlan: {
        ...state.deliveryPlan,
        batches: state.deliveryPlan.batches.map((candidate) =>
          candidate.id === batch.id
            ? { ...candidate, status: "shipped" as const }
            : candidate,
        ),
      },
      arrivalExecution: {
        ...state.arrivalExecution,
        events: [...state.arrivalExecution.events, event],
      },
    };
  }

  if (event.type === "receive") {
    if (batch.status !== "shipped") {
      return addBlocker(state, event, "板车尚未发运，不能签收");
    }
    return {
      ...state,
      version: state.version + 1,
      vessel: {
        ...state.vessel,
        vehicles: updateVehicles(state, batchIds, (pool) =>
          pool === "reserved" ? "delivered" : "at_vpc",
        ),
      },
      deliveryPlan: {
        ...state.deliveryPlan,
        batches: state.deliveryPlan.batches.map((candidate) =>
          candidate.id === batch.id
            ? { ...candidate, status: "received" as const }
            : candidate,
        ),
      },
      arrivalExecution: {
        ...state.arrivalExecution,
        events: [...state.arrivalExecution.events, event],
      },
    };
  }

  if (batch.status === "shipped" || batch.status === "received") {
    return addBlocker(state, event, "已发运批次不能取消或重新编排");
  }
  return {
    ...state,
    version: state.version + 1,
    deliveryPlan: {
      ...state.deliveryPlan,
      batches: state.deliveryPlan.batches.map((candidate) =>
        candidate.id === batch.id
          ? { ...candidate, status: "cancelled" as const }
          : candidate,
      ),
    },
    arrivalExecution: {
      ...state.arrivalExecution,
      events: [...state.arrivalExecution.events, event],
    },
  };
}

export function executionConservation(state: CampaignState): ExecutionTotals {
  const count = (status: VehicleStatus) =>
    state.vessel.vehicles.filter((vehicle) => vehicle.status === status).length;
  const delivered = count("delivered");
  const atVpc = count("at_vpc");
  return {
    total: state.vessel.vehicles.length,
    atSea: count("at_sea"),
    customs: count("customs"),
    pdi: count("pdi"),
    ready: count("ready"),
    loaded: count("loaded"),
    inTransit: count("in_transit"),
    delivered,
    atVpc,
    exception: count("exception"),
    terminal: delivered + atVpc,
  };
}

export function closeArrivalExecution(
  state: CampaignState,
): InventoryBaseline {
  const totals = executionConservation(state);
  if (
    totals.total !== 1800 ||
    totals.terminal !== 1800 ||
    state.arrivalExecution.blockers.length > 0
  ) {
    throw new Error("全部 1,800 台车辆到达终态且无阻断项后才能关闭到港执行");
  }
  const assignmentByVin = new Map(
    state.allocation?.assignments.map((item) => [item.vehicleId, item]) ?? [],
  );
  return {
    createdAt: "T+3",
    positions: state.vessel.vehicles.map((vehicle) => {
      const assignment = assignmentByVin.get(vehicle.id);
      return {
        vehicleId: vehicle.id,
        location:
          vehicle.pool === "reserved"
            ? (assignment?.destination ?? "客户交付点")
            : `${assignment?.targetVpc ?? "RUH"} VPC`,
        vpcId:
          vehicle.pool === "inventory"
            ? (assignment?.targetVpc ?? "RUH")
            : undefined,
        status: vehicle.pool === "reserved" ? "delivered" : "available",
      };
    }),
    vpcQuantity: totals.atVpc,
    deliveredOrderQuantity: totals.delivered,
  };
}
