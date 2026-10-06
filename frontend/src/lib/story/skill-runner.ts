import { allocateVessel } from "./allocation-engine";
import { buildDecisionEvidence } from "./decision-evidence";
import { analyzeCrisis } from "./crisis-engine";
import { planDelivery } from "./delivery-engine";
import { applyExecutionEvent, closeArrivalExecution } from "./execution-engine";
import { rebalanceDailyOrders } from "./rebalance-engine";
import { resolveStorySkill, skillAvailability } from "./skill-catalog";
import { startProfitRun } from "./profit-run";
import { startQueryRun } from "./query-run";
import { startDailyTransferRun } from "./daily-transfer-run";
import {
  startStorePlanningRun,
  type PlanningRunOptions,
} from "./store-planning-run";
import type {
  CampaignState,
  RouteId,
  StoryBlock,
  StoryCommand,
  StoryEvent,
  StoryRun,
} from "./types";

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
    ["allocation-logic", "分车规则与库存测算"],
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
    ["delivery-logic", "路线比较、配载与运力回压"],
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
    ["rebalance-logic", "逐单车源筛选与决策依据"],
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
  "/daily-transfer": [],
  "/smart-query": [],
  "/profit-analysis": [],
};

const nextSkill: Partial<Record<StoryCommand, StoryCommand[]>> = {
  "/crisis-brief": ["/vessel-allocation"],
  "/vessel-allocation": ["/delivery-plan"],
  "/delivery-plan": ["/arrival-execution"],
  "/arrival-execution": ["/daily-rebalance", "/daily-transfer"],
  "/daily-rebalance": ["/daily-rebalance"],
  "/daily-transfer": ["/daily-transfer"],
};

function runData(
  command: StoryCommand,
  state: CampaignState,
  businessDate: string,
) {
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
      reserved: plan.assignments.filter((item) => item.pool === "reserved")
        .length,
      inventory: plan.assignments.filter((item) => item.pool === "inventory")
        .length,
    };
  }
  if (command === "/delivery-plan") {
    const plan = planDelivery(state);
    const routes = plan.assignments.reduce<Record<RouteId, number>>(
      (counts, item) => ({ ...counts, [item.route]: counts[item.route] + 1 }),
      {
        west: 0,
        riyadh: 0,
        eastDirect: 0,
        riyadhIntercept: 0,
        dammamSafety: 0,
      },
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

function compactData(
  command: StoryCommand,
  index: number,
  state: CampaignState,
  businessDate: string,
) {
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
    const vpcTotals = plan.assignments.reduce<Record<string, number>>(
      (totals, item) => {
        if (item.targetVpc)
          totals[item.targetVpc] = (totals[item.targetVpc] ?? 0) + 1;
        return totals;
      },
      {},
    );
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
    return {
      index,
      ...data.expected,
      batchCount: state.deliveryPlan?.batches.length ?? 0,
    };
  }
  const plan = data.plan as ReturnType<typeof rebalanceDailyOrders>;
  return {
    index,
    plan,
    orderCount: plan.orders.length,
    candidateCount: plan.candidates.length,
    approvals: plan.decisions.filter(
      (item) => item.status === "approval_required",
    ).length,
    decisions: plan.decisions,
    candidates: plan.candidates,
  };
}

export function startStoryRun(
  command: StoryCommand,
  prompt: string,
  state: CampaignState,
  planningOptions: PlanningRunOptions = {},
): StoryRun {
  const skill = resolveStorySkill(command)!;
  const availability = skillAvailability(command, state);
  const id = `RUN-${command.slice(1).toUpperCase()}-${state.version}-${state.runs.length + 1}`;
  if (command === "/profit-analysis")
    return startProfitRun(id, prompt, state, planningOptions);
  if (command === "/smart-query")
    return startQueryRun(id, prompt || skill.defaultPrompt, state);
  if (command === "/vessel-allocation" || command === "/delivery-plan")
    return startStorePlanningRun(
      id,
      command,
      prompt || skill.defaultPrompt,
      state,
      planningOptions,
    );
  const businessDate =
    command === "/daily-rebalance" || command === "/daily-transfer"
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
  if (command === "/daily-transfer")
    return startDailyTransferRun(id, prompt || skill.defaultPrompt, state);
  const evidence = buildDecisionEvidence(command, state, businessDate);
  const events: StoryEvent[] = evidence.steps.map((step, index) => ({
    id: `${id}-EVENT-${index + 1}`,
    role:
      index === 0
        ? "data"
        : index === evidence.steps.length - 1
          ? "agent"
          : "analysis",
    title: step.title,
    detail: `${step.inputs.map((input) => `${input.label}：${input.value}`).join("；")}。\n${step.rule}\n${step.output}`,
    duration:
      command === "/crisis-brief" || command === "/arrival-execution"
        ? 700
        : 1300,
    operation: step.operation,
    sources: step.sources,
  }));
  const duration = Math.max(
    events.reduce((sum, event) => sum + event.duration, 0),
    blockTitles[command].length * 520 + 300,
  );
  const blocks: StoryBlock[] = blockTitles[command].map(
    ([type, title], index) => ({
      id: `${id}-BLOCK-${index + 1}`,
      type,
      title,
      status: "queued",
      skillRunId: id,
      inputVersion: state.version,
      revealAt: 520 * (index + 1),
      data: compactData(command, index, state, businessDate),
      interactions:
        index === blockTitles[command].length - 1
          ? ["查看依据", "导出快照"]
          : ["展开详情"],
      sourceRefs: ["RO-RO-JED-2026-10", `campaign-v${state.version}`],
    }),
  );
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
    evidence,
    blocks,
    decisions: [],
    resultVersion: null,
    nextSkillSuggestions: nextSkill[command] ?? [],
  };
}

export function advanceStoryRun(run: StoryRun, milliseconds: number): StoryRun {
  if (run.status !== "running" && run.status !== "paused") return run;
  const elapsed = Math.min(
    run.duration,
    run.elapsed + Math.max(0, milliseconds),
  );
  const complete = elapsed >= run.duration;
  return {
    ...run,
    elapsed,
    status: complete ? "complete" : "running",
    resultVersion: complete
      ? run.inputVersion + (run.query || run.planning || run.profit ? 0 : 1)
      : null,
    answer: complete
      ? (run.profit?.result.summaryText ??
        run.planningSummary ??
        run.query?.summary ??
        run.evidence?.conclusion ??
        run.answer ??
        `已完成${resolveStorySkill(run.command)?.title ?? run.command}，结果已同步到工作台。`)
      : run.answer,
    blocks: run.blocks.map((block) => ({
      ...block,
      status:
        complete || elapsed >= block.revealAt
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
    const progress = Math.min(
      1,
      Math.max(0, (run.elapsed - start) / event.duration),
    );
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
  if (run.command === "/smart-query" || run.planning || run.profit) {
    const saved = { ...run, resultVersion: state.version };
    return {
      ...state,
      activeRunId: run.id,
      runs: state.runs.some((item) => item.id === run.id)
        ? state.runs.map((item) => (item.id === run.id ? saved : item))
        : [...state.runs, saved],
    };
  }
  let next: CampaignState;
  if (run.command === "/crisis-brief") {
    next = {
      ...state,
      version: state.version + 1,
      crisis: analyzeCrisis(state),
    };
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
      deliveryPlan:
        plan.status === "blocked"
          ? plan
          : { ...plan, status: "published", publishedAt: "T-7" },
    };
  } else if (run.command === "/arrival-execution") {
    next = finishArrival(state);
  } else if (
    run.command === "/daily-rebalance" ||
    run.command === "/daily-transfer"
  ) {
    next = {
      ...state,
      version: state.version + 1,
      dailyOperations: [
        ...state.dailyOperations,
        rebalanceDailyOrders(state, run.businessDate),
      ],
    };
  } else {
    next = state;
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
