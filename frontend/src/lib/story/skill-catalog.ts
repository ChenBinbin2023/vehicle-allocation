import type { CampaignState, StoryCommand, StoryStage } from "./types";
import { latestDeliveryRun } from "./profit-run";
import { latestStoreAllocation } from "./store-planning-run";
import {
  dispatchFulfillmentPrompt,
  dispatchSelectionIssue,
  dispatchSourceRun,
} from "./dispatch-fulfillment";

export type StorySkill = {
  command: StoryCommand;
  title: string;
  description: string;
  stage: StoryStage;
  defaultPrompt: string;
};

export type SkillAvailability = {
  available: boolean;
  reason?: string;
};

export const storySkills: StorySkill[] = [
  {
    command: "/daily-dispatch",
    title: "每日调拨计划",
    description: "整理今日订单，逐车匹配车源、拼载配送并比较区域缺货方案",
    stage: "dispatch",
    defaultPrompt: "帮我整理今天需要处理的订单，并生成调度计划。",
  },
  {
    command: "/shortage-fulfillment",
    title: "缺货调度与采购订单",
    description: "按逐车已选方案生成缺货配送建议和授权店采购订单",
    stage: "dispatch",
    defaultPrompt: dispatchFulfillmentPrompt,
  },
  {
    command: "/query",
    title: "基本统计",
    description: "分析本船供需、历史船次、全网销速与门店库存",
    stage: "statistics",
    defaultPrompt:
      "查看截至 2026-08-05 的本船供给、订单缺口、全网销速与库存基本统计。",
  },
  {
    command: "/order-allocation",
    title: "订单分车",
    description: "按门店与车型分配订单，生成单港和双港物流建议",
    stage: "orders",
    defaultPrompt: "按门店和车型查看订单分车，并比较单港与双港物流方案。",
  },
  {
    command: "/crisis-brief",
    title: "单港影响研判",
    description: "识别达曼港关闭后，本船供需与东向运输风险",
    stage: "crisis",
    defaultPrompt:
      "分析两周后抵达吉达港的 1,800 台车辆，在达曼港关闭情况下的供需、库存和运输影响。",
  },
  {
    command: "/vessel-allocation",
    title: "分车计划模拟",
    description: "调整补库、物流与价格参数，模拟分车计划和经营结果",
    stage: "allocation",
    defaultPrompt:
      "模拟门店补库分车计划；总量=2500 预留比例=10% 基准WoS=4 级差=10%。",
  },
  {
    command: "/delivery-plan",
    title: "到店物流与港口比较",
    description: "按接车能力拆分直送、VPC 暂存和后续批次，比较单港与双港",
    stage: "delivery",
    defaultPrompt:
      "基于最新门店分车结果，模拟单港到店物流；按门店接车能力安排部分直送、VPC 暂存和后续配送，比较港口场景。",
  },
  {
    command: "/arrival-execution",
    title: "到港后 72 小时执行",
    description: "跟踪清关、PDI、发运、签收并形成库存基线",
    stage: "execution",
    defaultPrompt:
      "执行本船到港后的清关、PDI、装车和配送计划，并跟踪车辆在到港后 2–3 天内到达订单交付点或 VPC。",
  },
  {
    command: "/daily-rebalance",
    title: "每日订单调拨",
    description: "为门店订单寻找 VPC、门店或授权车商车源",
    stage: "rebalance",
    defaultPrompt:
      "分析今天各门店提交的订单，从 VPC、门店和授权车商库存中寻找最合适车源，并生成发货、调拨或回购方案。",
  },
  {
    command: "/daily-transfer",
    title: "每日调拨",
    description: "为 80 台企业大单组合全网车源，逐单取舍急单与普通订单",
    stage: "transfer",
    defaultPrompt:
      "整理今天的需求池：80 台 Hilux 企业大单需要多地集结车源，另有一笔高价值急单和一笔普通订单；请评估双端影响、生成调拨单，并跟踪执行异常。",
  },
  {
    command: "/profit-analysis",
    title: "销售贡献利润分析",
    description: "按订单、车型、门店拆解收入、采购和物流成本，定位亏损",
    stage: "profit",
    defaultPrompt:
      "基于最新到店物流快照，分析销售情景的订单、车型及门店贡献利润，并拆解物流成本和亏损原因。",
  },
];

export function resolveStorySkill(input: string): StorySkill | undefined {
  const command = input.trim().split(/[\s，,]+/)[0];
  if (command === "/skill")
    return storySkills.find(
      (skill) =>
        skill.command ===
        (/缺货/.test(input) && /选择|选定|已选|采购订单|采购单/.test(input)
          ? "/shortage-fulfillment"
          : "/daily-dispatch"),
    );
  // Restore historical smart-query canvases without exposing the retired command.
  if (command === "/smart-query" || command === "/smart_query")
    return {
      command: "/smart-query",
      title: "智能问数",
      stage: "query",
      description: "历史销量、库存与运费分析",
      defaultPrompt: "分析销量、库存与陆路运输成本。",
    };
  return storySkills.find((skill) => skill.command === command);
}

export function skillAvailability(
  command: StoryCommand,
  state: CampaignState,
  dispatchRunId?: string,
): SkillAvailability {
  if (command === "/shortage-fulfillment") {
    const reason = dispatchSelectionIssue(
      dispatchSourceRun(state, dispatchRunId)?.dispatch,
    );
    return reason ? { available: false, reason } : { available: true };
  }
  if (
    command === "/crisis-brief" ||
    command === "/smart-query" ||
    command === "/query" ||
    command === "/daily-dispatch" ||
    command === "/order-allocation"
  )
    return { available: true };
  if (command === "/profit-analysis")
    return latestDeliveryRun(state)
      ? { available: true }
      : { available: false, reason: "请先完成有效的到店物流模拟。" };
  if (command === "/vessel-allocation") return { available: true };
  if (command === "/delivery-plan") {
    return Boolean(latestStoreAllocation(state))
      ? { available: true }
      : { available: false, reason: "请先完成有效的分车草案。" };
  }
  if (command === "/arrival-execution") {
    return state.deliveryPlan?.status === "published"
      ? { available: true }
      : { available: false, reason: "请先发布分车与物流联合计划。" };
  }
  return state.inventoryBaseline
    ? { available: true }
    : { available: false, reason: "请先关闭到港执行并形成 VPC 库存基线。" };
}
