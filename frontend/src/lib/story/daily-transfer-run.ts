import { rebalanceDailyOrders } from "./rebalance-engine";
import type {
  CampaignState,
  StoryBlock,
  StoryEvent,
  StoryRun,
} from "./types";

export const transferDualImpact = {
  safetyWeeks: 2,
  nearby: {
    store: "利雅得北环店",
    distance: "18 km",
    freeStock: 3,
    activeOrders: 5,
    weeklySales: "2.4 台/周",
    coverBefore: "1.6 周",
    coverAfter: "0.8 周",
    nextArrival: "T+9 · 4 台已确认",
  },
  farther: {
    store: "利雅得旗舰店",
    distance: "46 km",
    freeStock: 4,
    activeOrders: 6,
    weeklySales: "1.0 台/周",
    coverBefore: "4.0 周",
    coverAfter: "3.0 周",
    nextArrival: "T+12 · 6 台已确认",
  },
};

export const transferException = {
  vin: "JED-HLX-0412",
  event: "候选车辆被源店售出",
  withdrawn: "JED VPC 24 台集结中的 1 台绑定失效",
  replacement: "JED-HLX-0455",
  arrivalShift: "到店日期 +1 天",
  costDelta: "费用不变",
  pending: "物流负责人确认新收货窗口",
  retained: "其余 79 台企业大单绑定与其他订单任务保留不动",
};

export function startDailyTransferRun(
  id: string,
  prompt: string,
  state: CampaignState,
): StoryRun {
  const businessDate = `T+${4 + state.dailyOperations.length}`;
  const plan = rebalanceDailyOrders(state, businessDate);
  const events: Array<Omit<StoryEvent, "id">> = [
    {
      role: "thinking",
      title: "整理今日需求池",
      detail:
        "08:30 工作台刷新：4 笔订单、昨日未解决缺口与取消释放车辆。先区分哪些必须处理、哪些已有覆盖、哪些需要取舍。",
      duration: 800,
      operation: "思考",
    },
    {
      role: "plan",
      title: "执行计划",
      detail:
        "① 核对订单有效性与既有覆盖。\n② 为企业大单组合全网车源。\n③ 测算调出与调入双端影响。\n④ 急单与普通订单逐单取舍。\n⑤ 确认方案并生成调拨单据。\n⑥ 跟踪执行异常并局部重排。",
      duration: 900,
      operation: "规划",
    },
    {
      role: "tool",
      title: "核对订单有效性与既有覆盖",
      detail:
        "读取今日 4 笔订单与库存基线快照，逐单核对配置、已绑定车辆与预计到店时间：企业大单 80 台缺车，高利润急单分到车但交期不达，普通零售与偏远订单已有可靠覆盖或既有班次。",
      duration: 1300,
      operation: "data.read · orders.validate",
      sources: ["03_库存/当前库存_门店.csv", "02_销速/销速汇总_门店.csv"],
    },
    {
      role: "analysis",
      title: "按紧急度整理待处理事项",
      detail:
        "按交期与订单价值排序：P1 企业大单要求承诺期内集中交付 80 台 Hilux，P1 高利润急单 48 小时内到店；P2 普通零售与偏远订单沿用既有方案，不占用今天的决策时间。",
      duration: 900,
      operation: "优先级排序",
    },
    {
      role: "tool",
      title: "为企业大单组合全网车源",
      detail:
        "逐一核验 VPC 自由库存、未发运补库改派、门店可释放与授权车商回购四类候选：RUH 40 + JED 24 + DMM 16 可按期集结，不击穿任一来源安全水位；回购候选报价与权属未确认，暂不计入可执行方案。",
      duration: 1400,
      operation: "sources.assemble · vpc.freeStock",
      sources: ["03_库存/当前库存_门店.csv", "01_供给/按月总表.csv"],
    },
    {
      role: "thinking",
      title: "最近门店调走将跌破安全线",
      detail:
        "高利润急单最近的同配置车源在利雅得北环店，但调出后覆盖仅 0.8 周，跌破 2 周安全线；稍远的利雅得旗舰店库存更充足，需要比较双端影响再决定。",
      duration: 800,
      operation: "再次思考",
    },
    {
      role: "validation",
      title: "双端影响测算：覆盖周数与安全线",
      detail:
        "北环店调出后覆盖 0.8 周 < 2 周安全线，列为安全线例外，需供应链负责人确认并安排 T+9 到货补回；旗舰店调出后仍有 3.0 周覆盖，可执行。目标订单获得 48 小时内到店，来源端损失与补回安排同时列示。",
      duration: 1200,
      operation: "coverage.simulate · safetyLine.check",
      sources: ["02_销速/销速汇总_门店.csv", "03_库存/当前库存_门店.csv"],
    },
    {
      role: "analysis",
      title: "逐单取舍：增量成本 vs 保住订单收益",
      detail:
        "高利润 LX 急单：同城调拨增量 2,800 SAR，保住订单毛利 46,000 SAR，推荐调拨。普通 Camry 订单：跨区专车 4,100 SAR 超过订单毛利，改走既有班次拼载 950 SAR，到店 +1 天，费用与到店日期交由销售与客户确认。",
      duration: 1200,
      operation: "tradeoff.evaluate",
    },
    {
      role: "tool",
      title: "执行前核验：订单有效性、车辆锁定、库存版本",
      detail:
        "核验 80 台企业大单车辆未被重复占用、库存版本一致；生成调拨单、回购单与运输任务三联单。企业大单与安全线例外进入审批列表，回购单列示待商务财务确认。",
      duration: 1200,
      operation: "lock.verify · docs.generate",
      sources: ["03_库存/当前库存_门店.csv"],
    },
    {
      role: "tool",
      title: "异常监听：候选车辆被源店售出",
      detail:
        "监听执行回执：JED VPC 候选 VIN JED-HLX-0412 在确认前被源店售出，对应集结绑定失效，需要局部重排。",
      duration: 800,
      operation: "exception.watch · vin.release",
    },
    {
      role: "analysis",
      title: "撤回失效建议并重新匹配",
      detail:
        "撤回失效绑定，以同 VPC 同配置 JED-HLX-0455 补位：到店日期 +1 天，费用不变，新收货窗口待物流负责人确认；其余 79 台企业大单绑定与其他订单任务保留不动。",
      duration: 900,
      operation: "replan.partial",
    },
    {
      role: "agent",
      title: "今日调拨方案已生成",
      detail:
        "80 台企业大单组合方案待批准，高利润急单推荐同城调拨，普通订单拼载执行；1 项安全线例外与 1 笔回购待负责人确认。批准后锁定车辆并释放运输任务。",
      duration: 1300,
      operation: "阶段总结",
    },
  ];
  const blocks: StoryBlock[] = [
    {
      type: "transfer-demand-pool",
      title: "今日需求池与覆盖核对",
      revealAt: 3400,
      data: { plan },
      interactions: ["展开详情"],
      sourceRefs: ["03_库存/当前库存_门店.csv", "02_销速/销速汇总_门店.csv"],
    },
    {
      type: "transfer-enterprise-assembly",
      title: "80 台 Hilux 企业大单集结方案",
      revealAt: 5200,
      data: { plan },
      interactions: ["展开详情"],
      sourceRefs: ["03_库存/当前库存_门店.csv"],
    },
    {
      type: "transfer-dual-impact",
      title: "双端影响：覆盖周数与安全线",
      revealAt: 7000,
      data: { dualImpact: transferDualImpact },
      interactions: ["展开详情"],
      sourceRefs: ["02_销速/销速汇总_门店.csv", "03_库存/当前库存_门店.csv"],
    },
    {
      type: "transfer-tradeoff",
      title: "急单与普通订单的取舍",
      revealAt: 8600,
      data: { plan },
      interactions: ["展开详情"],
      sourceRefs: ["04_运力/路线主数据.csv"],
    },
    {
      type: "transfer-execution-docs",
      title: "调拨单 · 回购单 · 运输任务",
      revealAt: 10400,
      data: { plan },
      interactions: ["批准方案", "查看依据"],
      sourceRefs: ["03_库存/当前库存_门店.csv", `campaign-v${state.version}`],
    },
    {
      type: "transfer-exception-replan",
      title: "异常撤回与局部重排",
      revealAt: 11300,
      data: { exception: transferException },
      interactions: ["展开详情"],
      sourceRefs: ["03_库存/当前库存_门店.csv"],
    },
    {
      type: "transfer-value-summary",
      title: "今日调拨价值总结",
      revealAt: 12300,
      data: { plan },
      interactions: ["导出快照"],
      sourceRefs: [`campaign-v${state.version}`],
    },
  ].map((block, index) => ({
    id: `${id}-BLOCK-${index + 1}`,
    status: "queued",
    skillRunId: id,
    inputVersion: state.version,
    ...block,
  }));
  return {
    id,
    command: "/daily-transfer",
    prompt,
    businessDate,
    inputVersion: state.version,
    status: "running",
    elapsed: 0,
    duration: events.reduce((sum, event) => sum + event.duration, 0),
    events: events.map((event, index) => ({
      ...event,
      id: `${id}-EVENT-${index + 1}`,
    })),
    blocks,
    decisions: [],
    resultVersion: null,
    nextSkillSuggestions: ["/daily-transfer"],
    answer:
      "今日 4 笔订单中 3 笔获得可执行方案：80 台 Hilux 企业大单以 RUH 40 + JED 24 + DMM 16 组合集结，增量运费 40,800 SAR；高利润急单同城调拨，增量 2,800 SAR 保住 46,000 SAR 毛利；普通订单改走既有班次拼载 950 SAR，避免 4,100 SAR 跨区专车。\n\n安全线例外 1 项：利雅得北环店不调出，改用利雅得旗舰店车源，T+9 到货后补回；回购候选 1 台待商务财务确认，未计入履约结果。异常 1 起：VIN JED-HLX-0412 被源店售出，已撤回并由 JED-HLX-0455 补位，到店 +1 天。未满足缺口：无，偏远 8 台随西北周班在承诺期内交付。",
  };
}
