import type { CampaignState, StoryCommand, StoryStage } from "./types";

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
    title: "1,800 台船次分车",
    description: "保护已预订订单，补充三大 VPC 并保留机动量",
    stage: "allocation",
    defaultPrompt:
      "为本船 1,800 台车制定分车计划，优先保护已预订订单，再补充三大 VPC 库存，并保留必要机动量。",
  },
  {
    command: "/delivery-plan",
    title: "单港物流与配载",
    description: "把分车草案转成可执行的路线、板车和交付计划",
    stage: "delivery",
    defaultPrompt:
      "基于当前分车草案，设计吉达单港条件下的运输和配载计划，比较订单车、补货车及偏远地区的物流方案。",
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
];

export function resolveStorySkill(input: string): StorySkill | undefined {
  const command = input.trim().split(/\s+/)[0];
  return storySkills.find((skill) => skill.command === command);
}

export function skillAvailability(
  command: StoryCommand,
  state: CampaignState,
): SkillAvailability {
  if (command === "/crisis-brief") return { available: true };
  if (command === "/vessel-allocation") {
    return state.crisis
      ? { available: true }
      : { available: false, reason: "请先运行 /crisis-brief 完成单港影响研判。" };
  }
  if (command === "/delivery-plan") {
    return state.allocation?.status === "ready"
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
