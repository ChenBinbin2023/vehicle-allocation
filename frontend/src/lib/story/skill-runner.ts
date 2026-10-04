import { allocateVessel } from "./allocation-engine";
import { analyzeCrisis } from "./crisis-engine";
import { planDelivery } from "./delivery-engine";
import {
  applyExecutionEvent,
  closeArrivalExecution,
} from "./execution-engine";
import { rebalanceDailyOrders } from "./rebalance-engine";
import { resolveStorySkill, skillAvailability } from "./skill-catalog";
import type {
  CampaignState,
  RouteId,
  StoryBlock,
  StoryCommand,
  StoryEvent,
  StoryRun,
} from "./types";

const eventCopy: Record<StoryCommand, Array<[StoryEvent["role"], string, string]>> = {
  "/crisis-brief": [
    ["thinking", "建立分析边界", "锁定 JEDDAH HORIZON 船次和 T-14 决策窗口"],
    ["data", "读取船次与需求", "已读取 1,800 台 VIN、预订订单和三大 VPC 库存"],
    ["validation", "检查网络约束", "确认达曼港不可用，全部车辆只能从吉达入境"],
    ["analysis", "对比双港与单港", "正在测算东向干线、重复装卸与收货窗口压力"],
    ["agent", "形成危机简报", "已给出本船分车与物流联合决策范围"],
  ],
  "/vessel-allocation": [
    ["thinking", "建立分车优先级", "订单保护优先于补库与机动库存"],
    ["data", "锁定订单池", "锁定企业、零售和高利润订单共 620 台"],
    ["analysis", "计算补货缺口", "评估吉达、利雅得和达曼 VPC 覆盖变化"],
    ["analysis", "分配库存池", "将 1,180 台分配至补货、机动和异常缓冲"],
    ["validation", "校验 VIN 守恒", "检查重复占用、遗漏和目的地冲突"],
    ["agent", "生成分车草案", "分车草案已就绪，等待物流能力校验"],
  ],
  "/delivery-plan": [
    ["thinking", "读取分车草案", "按方向、交期和保护等级聚类 1,800 台车辆"],
    ["analysis", "生成五类路线", "建立西部、利雅得、东部直达、截流和安全库存路线"],
    ["data", "生成板车批次", "按 8 位板车形成装载批次和释放节奏"],
    ["validation", "校验路线容量", "检查班次、收货窗口和装载率"],
    ["analysis", "比较订单方案", "比较企业、高配、普通、补货和偏远地区方案"],
    ["validation", "回压分车计划", "容量缺口仅回压受影响的低优先车辆"],
    ["agent", "发布联合计划", "分车与物流计划已具备执行条件"],
  ],
  "/arrival-execution": [
    ["thinking", "读取联合计划", "载入已发布路线、批次和收货窗口"],
    ["data", "滚装船到港", "接收到港事件并开启清关作业"],
    ["data", "清关与 PDI", "按批次释放车辆并匹配已确认板车"],
    ["analysis", "执行发运", "跟踪港口待装、在途和签收"],
    ["validation", "检查局部异常", "仅对未发运的受影响车辆重排"],
    ["analysis", "核对最终状态", "核对订单交付与三大 VPC 到货"],
    ["agent", "形成库存基线", "1,800 台全部到达终态，切换每日运营"],
  ],
  "/daily-rebalance": [
    ["thinking", "读取今日订单", "识别企业、高利润、普通和偏远地区订单"],
    ["data", "读取可售库存", "读取三大 VPC、门店和授权车商库存"],
    ["validation", "过滤不可调车辆", "排除锁定、冻结和无调度权车源"],
    ["analysis", "生成候选车源", "比较本地、邻近、门店、车商和下一船"],
    ["analysis", "求解企业大单", "组合多来源库存并保护来源端安全水位"],
    ["analysis", "评估利润与成本", "普通订单不开亏损专车，偏远订单优先拼单"],
    ["validation", "检查回购条件", "未确认权属与付款授权的车源不可执行"],
    ["agent", "输出今日方案", "生成发货动作和待审批事项"],
  ],
};

const blockTitles: Record<StoryCommand, Array<[string, string]>> = {
  "/crisis-brief": [
    ["vessel-hero", "船次与 T-14 倒计时"],
    ["vehicle-mix", "1,800 台车型与配置结构"],
    ["demand-gap", "订单需求与 VPC 补货缺口"],
    ["network-compare", "双港与吉达单港路线对比"],
    ["risk-board", "东向运力压力与风险"],
    ["decision-scope", "Agent 建议的决策范围"],
  ],
  "/vessel-allocation": [
    ["supply-guard", "可分供给与冻结车辆"],
    ["pool-overview", "订单池与补货池总览"],
    ["order-breakdown", "订单保护明细"],
    ["vpc-allocation", "三大 VPC 补货"],
    ["coverage-change", "区域覆盖变化"],
    ["vin-table", "VIN 分配明细"],
    ["allocation-exceptions", "未满足需求与待审批例外"],
    ["allocation-version", "分车草案版本"],
  ],
  "/delivery-plan": [
    ["release-rhythm", "港口 D1–D3 释放节奏"],
    ["route-network", "吉达单港五类路线"],
    ["truck-loads", "板车与配载计划"],
    ["capacity-board", "路线容量与装载率"],
    ["order-logistics", "不同订单类型物流方案"],
    ["cost-compare", "成本、时效与装卸次数"],
    ["logistics-pressure", "物流回压与分车调整"],
    ["joint-publish", "联合计划发布检查"],
  ],
  "/arrival-execution": [
    ["execution-timeline", "T0 至 T+3 执行时间轴"],
    ["customs-pdi", "清关与 PDI 释放进度"],
    ["port-queue", "港口待装车辆"],
    ["dispatch-board", "板车班次执行板"],
    ["transit-network", "全国在途路线"],
    ["order-delivery", "订单车交付状态"],
    ["vpc-arrivals", "三大 VPC 到货进度"],
    ["execution-exceptions", "异常与局部重排"],
    ["final-conservation", "1,800 台最终状态守恒"],
    ["inventory-baseline", "每日运营库存基线"],
  ],
  "/daily-rebalance": [
    ["daily-orders", "今日订单池"],
    ["order-priority", "优先级与承诺时间"],
    ["vpc-fulfillment", "VPC 正常发货方案"],
    ["source-network", "候选车源网络"],
    ["enterprise-assembly", "企业大单集结方案"],
    ["premium-transfer", "高利润订单调拨"],
    ["retail-options", "普通订单建议"],
    ["remote-consolidation", "偏远地区集单配送"],
    ["store-impact", "门店调出影响"],
    ["buyback-conditions", "授权车商回购条件"],
    ["daily-approvals", "今日待审批事项"],
    ["daily-execution", "发货、签收与库存更新"],
  ],
};

const nextSkill: Partial<Record<StoryCommand, StoryCommand[]>> = {
  "/crisis-brief": ["/vessel-allocation"],
  "/vessel-allocation": ["/delivery-plan"],
  "/delivery-plan": ["/arrival-execution"],
  "/arrival-execution": ["/daily-rebalance"],
  "/daily-rebalance": ["/daily-rebalance"],
};

function runData(command: StoryCommand, state: CampaignState, businessDate: string) {
  if (command === "/crisis-brief") {
    const analysis = analyzeCrisis(state);
    return {
      vessel: state.vessel,
      analysis,
      demand: state.demand,
      vpcs: state.vpcs,
    };
  }
  if (command === "/vessel-allocation") {
    const plan = allocateVessel(state);
    return {
      plan,
      reserved: plan.assignments.filter((item) => item.pool === "reserved").length,
      inventory: plan.assignments.filter((item) => item.pool === "inventory").length,
    };
  }
  if (command === "/delivery-plan") {
    const plan = planDelivery(state);
    const routes = plan.assignments.reduce<Record<RouteId, number>>(
      (counts, item) => ({ ...counts, [item.route]: counts[item.route] + 1 }),
      { west: 0, riyadh: 0, eastDirect: 0, riyadhIntercept: 0, dammamSafety: 0 },
    );
    return { plan, routes, batchCount: plan.batches.length };
  }
  if (command === "/arrival-execution") {
    return {
      deliveryPlan: state.deliveryPlan,
      expected: { total: 1800, deliveredOrders: 620, vpcInventory: 1180 },
    };
  }
  const plan = rebalanceDailyOrders(state, businessDate);
  return { plan };
}

function compactData(command: StoryCommand, index: number, state: CampaignState, businessDate: string) {
  const data = runData(command, state, businessDate);
  if (command === "/crisis-brief") {
    const analysis = data.analysis as ReturnType<typeof analyzeCrisis>;
    return {
      index,
      total: analysis.vesselQuantity,
      reserved: analysis.reservedQuantity,
      inventory: analysis.inventoryQuantity,
      eastboundPressure: analysis.eastboundPressure,
      risks: analysis.risks,
      comparison: analysis.comparison,
    };
  }
  if (command === "/vessel-allocation") {
    const plan = data.plan as ReturnType<typeof allocateVessel>;
    const vpcTotals = plan.assignments.reduce<Record<string, number>>((totals, item) => {
      if (item.targetVpc) totals[item.targetVpc] = (totals[item.targetVpc] ?? 0) + 1;
      return totals;
    }, {});
    return {
      index,
      total: plan.assignments.length,
      reserved: data.reserved,
      inventory: data.inventory,
      issues: plan.issues,
      planId: plan.id,
      sample: plan.assignments.slice(0, 12),
      vpcTotals,
      status: plan.status,
    };
  }
  if (command === "/delivery-plan") {
    const plan = data.plan as ReturnType<typeof planDelivery>;
    return {
      index,
      routes: data.routes,
      batchCount: data.batchCount,
      issues: plan.issues,
      status: plan.status,
      sample: plan.batches.slice(0, 8),
    };
  }
  if (command === "/arrival-execution") {
    return { index, ...data.expected, batchCount: state.deliveryPlan?.batches.length ?? 0 };
  }
  const plan = data.plan as ReturnType<typeof rebalanceDailyOrders>;
  return {
    index,
    plan,
    orderCount: plan.orders.length,
    candidateCount: plan.candidates.length,
    approvals: plan.decisions.filter((item) => item.status === "approval_required").length,
    decisions: plan.decisions,
    candidates: plan.candidates,
  };
}

export function startStoryRun(
  command: StoryCommand,
  prompt: string,
  state: CampaignState,
): StoryRun {
  const skill = resolveStorySkill(command)!;
  const availability = skillAvailability(command, state);
  const id = `RUN-${command.slice(1).toUpperCase()}-${state.version}-${state.runs.length + 1}`;
  const businessDate = command === "/daily-rebalance"
    ? `T+${4 + state.dailyOperations.length}`
    : "T-14 / T+3";
  if (!availability.available) {
    return {
      id,
      command,
      prompt,
      businessDate,
      inputVersion: state.version,
      status: "blocked",
      elapsed: 0,
      duration: 0,
      events: [],
      blocks: [],
      decisions: [],
      resultVersion: null,
      nextSkillSuggestions: [],
      blockedReason: availability.reason,
      answer: availability.reason,
    };
  }
  const events: StoryEvent[] = eventCopy[command].map((item, index) => ({
    id: `${id}-EVENT-${index + 1}`,
    role: item[0],
    title: item[1],
    detail: item[2],
    duration: 700,
  }));
  const duration = Math.max(events.length * 700, blockTitles[command].length * 520 + 300);
  const blocks: StoryBlock[] = blockTitles[command].map(([type, title], index) => ({
    id: `${id}-BLOCK-${index + 1}`,
    type,
    title,
    status: "queued",
    skillRunId: id,
    inputVersion: state.version,
    revealAt: 520 * (index + 1),
    data: compactData(command, index, state, businessDate),
    interactions: index === blockTitles[command].length - 1 ? ["查看依据", "导出快照"] : ["展开详情"],
    sourceRefs: ["RO-RO-JED-2026-10", `campaign-v${state.version}`],
  }));
  return {
    id,
    command,
    prompt: prompt || skill.defaultPrompt,
    businessDate,
    inputVersion: state.version,
    status: "running",
    elapsed: 0,
    duration,
    events,
    blocks,
    decisions: [],
    resultVersion: null,
    nextSkillSuggestions: nextSkill[command] ?? [],
  };
}

export function advanceStoryRun(run: StoryRun, milliseconds: number): StoryRun {
  if (run.status !== "running" && run.status !== "paused") return run;
  const elapsed = Math.min(run.duration, run.elapsed + Math.max(0, milliseconds));
  const complete = elapsed >= run.duration;
  return {
    ...run,
    elapsed,
    status: complete ? "complete" : "running",
    resultVersion: complete ? run.inputVersion + 1 : null,
    answer: complete
      ? `已完成${resolveStorySkill(run.command)?.title ?? run.command}，结果已同步到工作台。`
      : run.answer,
    blocks: run.blocks.map((block) => ({
      ...block,
      status: complete || elapsed >= block.revealAt
        ? "ready"
        : elapsed >= block.revealAt - 260
          ? "streaming"
          : "queued",
    })),
  };
}

export function visibleStoryBlocks(run: StoryRun): StoryBlock[] {
  return run.blocks.filter((block) => block.status !== "queued");
}

export function markStoryRunStale(
  run: StoryRun,
  currentVersion: number,
): StoryRun {
  const sourceVersion = run.resultVersion ?? run.inputVersion;
  if (currentVersion === sourceVersion) return run;
  return {
    ...run,
    blocks: run.blocks.map((block) =>
      block.status === "queued" ? block : { ...block, status: "stale" },
    ),
  };
}

export function visibleStoryEvents(run: StoryRun): StoryEvent[] {
  let cursor = 0;
  return run.events.flatMap((event) => {
    const start = cursor;
    cursor += event.duration;
    if (run.elapsed < start) return [];
    const progress = Math.min(1, Math.max(0, (run.elapsed - start) / event.duration));
    const characters = Math.max(1, Math.ceil(event.detail.length * progress));
    return [{ ...event, detail: event.detail.slice(0, characters) }];
  });
}

function finishArrival(state: CampaignState): CampaignState {
  if (!state.deliveryPlan) return state;
  let next = applyExecutionEvent(state, {
    id: `AUTO-ARRIVE-${state.version}`,
    type: "arrive",
    day: 0,
  });
  const vehicleIds = next.vessel.vehicles.map((vehicle) => vehicle.id);
  next = applyExecutionEvent(next, {
    id: `AUTO-CLEAR-${state.version}`,
    type: "clear",
    day: 0,
    vehicleIds,
  });
  next = applyExecutionEvent(next, {
    id: `AUTO-PDI-${state.version}`,
    type: "pdi",
    day: 1,
    vehicleIds,
  });
  for (const batch of next.deliveryPlan!.batches) {
    next = applyExecutionEvent(next, {
      id: `AUTO-SHIP-${batch.id}`,
      type: "ship",
      day: batch.departDay,
      batchId: batch.id,
    });
    next = applyExecutionEvent(next, {
      id: `AUTO-RECEIVE-${batch.id}`,
      type: "receive",
      day: batch.arrivalDay,
      batchId: batch.id,
    });
  }
  return {
    ...next,
    phase: "daily",
    inventoryBaseline: closeArrivalExecution(next),
    arrivalExecution: { ...next.arrivalExecution, closedAt: "T+3" },
  };
}

export function applyStoryRunResult(
  state: CampaignState,
  run: StoryRun,
): CampaignState {
  if (run.status !== "complete" || state.version !== run.inputVersion) {
    return state;
  }
  let next: CampaignState;
  if (run.command === "/crisis-brief") {
    next = { ...state, version: state.version + 1, crisis: analyzeCrisis(state) };
  } else if (run.command === "/vessel-allocation") {
    next = {
      ...state,
      version: state.version + 1,
      allocation: allocateVessel(state),
    };
  } else if (run.command === "/delivery-plan") {
    const plan = planDelivery(state);
    next = {
      ...state,
      version: state.version + 1,
      deliveryPlan: { ...plan, status: "published", publishedAt: "T-7" },
    };
  } else if (run.command === "/arrival-execution") {
    next = finishArrival(state);
  } else {
    next = {
      ...state,
      version: state.version + 1,
      dailyOperations: [
        ...state.dailyOperations,
        rebalanceDailyOrders(state, run.businessDate),
      ],
    };
  }
  const completedRun = { ...run, resultVersion: next.version };
  const exists = next.runs.some((item) => item.id === run.id);
  return {
    ...next,
    activeRunId: run.id,
    runs: exists
      ? next.runs.map((item) => (item.id === run.id ? completedRun : item))
      : [...next.runs, completedRun],
  };
}
