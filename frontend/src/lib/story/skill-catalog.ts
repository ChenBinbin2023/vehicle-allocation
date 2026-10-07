import type { CampaignState, StoryCommand, StoryStage } from "./types";
import { latestDeliveryRun } from "./profit-run";
import { latestStoreAllocation } from "./store-planning-run";

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
    command: "/crisis-brief",
    title: "单港影响研判",
    description: "识别达曼港关闭后，本船供需与东向运输风险",
    stage: "crisis",
    defaultPrompt:
      "分析两周后抵达吉达港的 1,800 台车辆，在达曼港关闭情况下的供需、库存和运输影响。",
  },
  {
    command: "/vessel-allocation",
    title: "2,500 台船次分车",
    description:
      "查看基本统计、门店订单和单/双港物流建议，再按门店销速与 WoS 注水分车",
    stage: "allocation",
    defaultPrompt:
      "先展示截至2026-08-05的供需、销速和库存模拟基本统计，再展示订单分车与门店补库；总量=2500 预留比例=10% 基准WoS=4 级差=30%。",
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
  {
    command: "/smart-query",
    title: "智能问数",
    description: "按区域、VPC 与门店分析销量预测、直营/授权库存及陆路运费",
    stage: "query",
    defaultPrompt:
      "查看 2026 年各主要区域、VPC 和门店的月度销量与预测、直营店和授权店库存，并比较双港口与吉达单港的陆路运输成本。",
  },
];

export function resolveStorySkill(input: string): StorySkill | undefined {
  const command = input.trim().split(/\s+/)[0];
  return storySkills.find((skill) => skill.command === command);
}

export function skillAvailability(
  command: StoryCommand,
  state: CampaignState,
): SkillAvailability {
  if (command === "/crisis-brief" || command === "/smart-query")
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
