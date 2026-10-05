import { allocateVessel } from "./allocation-engine";
import { analyzeCrisis } from "./crisis-engine";
import { planDelivery } from "./delivery-engine";
import { rebalanceDailyOrders } from "./rebalance-engine";
import type {
  CampaignState,
  DailyPlan,
  SourceCandidate,
  StoryCommand,
  VpcId,
} from "./types";

export type DecisionStep = {
  title: string;
  operation: string;
  inputs: Array<{ label: string; value: string }>;
  rule: string;
  output: string;
  sources: string[];
};
export type ReplenishmentRow = {
  vpc: VpcId;
  name: string;
  target: number;
  available: number;
  inbound: number;
  orders: number;
  gap: number;
};
export type DecisionEvidence = {
  kind: "allocation" | "delivery" | "rebalance" | "crisis" | "execution";
  objective: string;
  conclusion: string;
  steps: DecisionStep[];
  replenishment?: ReplenishmentRow[];
  allocation?: ReturnType<typeof allocateVessel>;
  delivery?: ReturnType<typeof planDelivery>;
  dailyPlan?: DailyPlan;
  // Only the business inputs needed by scenario calculation, with no run history.
  scenarioInput?: Pick<
    CampaignState,
    "vessel" | "demand" | "vpcs" | "planningParameters" | "allocation"
  >;
};

function allocationTotals(plan: ReturnType<typeof allocateVessel>) {
  return plan.assignments.reduce<Record<VpcId, number>>(
    (totals, item) => {
      if (item.targetVpc) totals[item.targetVpc] += 1;
      return totals;
    },
    { JED: 0, RUH: 0, DMM: 0 },
  );
}

export function simulateAllocation(state: CampaignState, safetyStock: number) {
  const plan = allocateVessel(state, { dammamSafetyStock: safetyStock });
  return {
    plan,
    vpcs: allocationTotals(plan),
    protected: plan.assignments.filter((item) => item.pool === "reserved")
      .length,
    inventory: plan.assignments.filter((item) => item.pool === "inventory")
      .length,
  };
}

export function simulateCapacity(state: CampaignState, riyadhCapacity: number) {
  const plan = planDelivery(state, {
    routeCapacity: { riyadh: riyadhCapacity },
  });
  const affectedIds = new Set(
    plan.issues.flatMap((issue) => issue.vehicleIds ?? []),
  );
  const affected =
    state.allocation?.assignments.filter((item) =>
      affectedIds.has(item.vehicleId),
    ) ?? [];
  return {
    plan,
    affected,
    protectedAffected: affected.filter((item) => item.pool === "reserved")
      .length,
    cost: plan.batches.reduce((sum, batch) => sum + batch.cost, 0),
    utilization: plan.batches.length ? 1800 / (plan.batches.length * 8) : 0,
  };
}

export function evaluateOrderSources(plan: DailyPlan, orderId: string) {
  const order = plan.orders.find((item) => item.id === orderId);
  if (!order) return [];
  return plan.candidates
    .filter((item) => item.orderId === orderId)
    .map((candidate) => {
      const reasons = [...candidate.unmetConditions];
      if (
        !candidate.ownershipConfirmed &&
        !reasons.some((reason) => reason.includes("权属"))
      )
        reasons.push("权属未确认");
      if (candidate.leadDays > order.dueInDays)
        reasons.push(`超过 ${order.dueInDays} 天承诺`);
      if (!candidate.vehicleIds.length && !reasons.length)
        reasons.push("没有可调度 VIN");
      return {
        ...candidate,
        eligible:
          candidate.executable &&
          candidate.ownershipConfirmed &&
          !reasons.length,
        exclusionReason: reasons.join(" · "),
        netContribution: order.margin + candidate.profitImpact,
        // Each enterprise source supplies only part of the order; its margin is not repeated.
        contributionLabel:
          order.type === "enterprise"
            ? "整单毛利 − 本来源成本"
            : "毛利 − 增量成本",
      };
    });
}

const number = (value: number) => value.toLocaleString("en-US");
const step = (
  title: string,
  operation: string,
  inputs: DecisionStep["inputs"],
  rule: string,
  output: string,
  sources: string[],
): DecisionStep => ({ title, operation, inputs, rule, output, sources });

export function buildDecisionEvidence(
  command: StoryCommand,
  state: CampaignState,
  businessDate: string,
): DecisionEvidence {
  const manifest = `${state.vessel.name} · 船次清单`;
  const scenarioInput = {
    vessel: state.vessel,
    demand: state.demand,
    vpcs: state.vpcs,
    planningParameters: state.planningParameters,
    allocation: state.allocation,
  };
  if (command === "/vessel-allocation") {
    const allocation = allocateVessel(state);
    const safety = state.planningParameters.dammamSafetyStock;
    const baseline = {
      JED: { target: 660, orders: 120 },
      RUH: { target: 790 - safety, orders: 80 },
      DMM: { target: 90 + safety, orders: 120 },
    };
    const replenishment = state.vpcs.map((vpc) => {
      const policy = baseline[vpc.id];
      return {
        vpc: vpc.id,
        name: vpc.name,
        target: policy.target,
        available: vpc.openingStock,
        inbound: 0,
        orders: policy.orders,
        gap: Math.max(0, policy.target - vpc.openingStock + policy.orders),
      };
    });
    const totals = allocationTotals(allocation);
    return {
      kind: "allocation",
      objective: "先兑现订单承诺，再恢复区域覆盖；让库存留在能快速响应的位置。",
      conclusion: `620 台订单硬保护；1,180 台库存分配至吉达 ${totals.JED}、利雅得 ${totals.RUH}、达曼 ${totals.DMM}。`,
      replenishment,
      allocation,
      scenarioInput,
      steps: [
        step(
          "读取供需快照",
          "数据读取",
          [
            { label: "船次供给", value: "1,800 个唯一 VIN" },
            { label: "需求类别", value: "订单 620 / 库存 1,180" },
          ],
          "车辆必须具备有效 VIN 和需求归属；冻结车辆先退出可分池。",
          "1,800 台进入可分池，当前冻结 0 台。",
          [manifest, "销售订单快照 · T-10"],
        ),
        step(
          "保护已确认订单",
          "约束校验",
          [
            { label: "企业合同", value: "240 台" },
            { label: "付款零售", value: "290 台" },
            { label: "稀缺配置", value: "90 台" },
          ],
          "按订单配置与目的地硬锁定；后续补货和机动库存不能占用这些 VIN。",
          "620 台已保护，余量 1,180 台。",
          ["合同与付款订单池", "VIN → 需求占用表"],
        ),
        step(
          "计算区域补货缺口",
          "缺口计算",
          replenishment.map((row) => ({
            label: row.name,
            value: `${row.target} − ${row.available} − ${row.inbound} + ${row.orders} = ${row.gap} 台`,
          })),
          "有效补货缺口 = max(0, 目标覆盖量 − 可售库存 − 已确认在途 + 订单需求)。目标覆盖量按危机策略设定。",
          `${replenishment.reduce((sum, row) => sum + row.gap, 0)} 台明确补货；另保留 300 台机动和 100 台异常缓冲。`,
          ["三 VPC 库存快照", "单港库存覆盖策略 · 演示参数"],
        ),
        step(
          "重算库存落点",
          "规则分配",
          [
            { label: "达曼自由库存", value: `${safety} 台` },
            { label: "中央响应能力", value: `${totals.RUH} 台留在利雅得` },
          ],
          "东部已知订单直达；中东部需求在利雅得截流；仅自由安全库存进入达曼 VPC。",
          `补库落点：JED ${totals.JED} / RUH ${totals.RUH} / DMM ${totals.DMM}。`,
          ["最终交付地址", "单港路线与区域保障规则"],
        ),
        step(
          "校验并交给物流",
          "交叉校验",
          [
            {
              label: "VIN 去重",
              value: `${new Set(allocation.assignments.map((item) => item.vehicleId)).size} / 1,800`,
            },
            { label: "阻断项", value: String(allocation.issues.length) },
          ],
          "数量守恒只是第一道检查；路线容量不通过时，仅回压未承诺的低优先库存。",
          "形成分车草案，等待按线路校验板位和交期。",
          [allocation.id, "VIN 唯一占用规则"],
        ),
      ],
    };
  }
  if (command === "/delivery-plan") {
    const delivery = planDelivery(state);
    const cost = delivery.batches.reduce((sum, batch) => sum + batch.cost, 0);
    return {
      kind: "delivery",
      objective: "在客户承诺与路线容量内，减少无效中转和空板位。",
      conclusion:
        delivery.status === "blocked"
          ? `物流计算完成，但有 ${delivery.issues.length} 项阻断；联合计划未发布，请调整分车或确认新增运力。`
          : `${delivery.batches.length} 个板车批次，预算 ${number(cost)} SAR；逐 VIN 绑定路线与班次。`,
      delivery,
      scenarioInput,
      steps: [
        step(
          "读取车辆运输需求",
          "数据读取",
          [
            { label: "分车版本", value: state.allocation?.id ?? "缺失" },
            { label: "运输范围", value: "1,800 台 / 五类去向" },
          ],
          "按最终需求地址识别干线方向；VPC 区域归属不直接决定路径。",
          "将订单、补货与机动 VIN 转为运输需求。",
          [state.allocation?.id ?? "分车草案", "车辆目的地表"],
        ),
        step(
          "生成路径并比较",
          "方案比较",
          [
            { label: "东部已知订单", value: "直达 vs 达曼二次短驳" },
            { label: "中东部过渡带", value: "利雅得截流 vs 达曼折返" },
          ],
          "先检验交期，再比较全程干线 + 中转 + 末端费用；低费用但超承诺的方案先排除。",
          "东部订单穿透直达，中东部在利雅得截流。",
          ["单港候选路线", "线路运价表 · 演示报价"],
        ),
        step(
          "配载与班次匹配",
          "配载计算",
          [
            { label: "板车模板", value: "每板 8 位" },
            {
              label: "装载率",
              value: `${((1800 / (delivery.batches.length * 8)) * 100).toFixed(1)}%`,
            },
          ],
          "同方向成批，尾板允许不足 8 台；每台 VIN 只进入一个 batchId。装载模板为演示规则。",
          `${delivery.batches.length} 个批次，共 ${delivery.batches.length * 8} 个板位。`,
          ["8 位板车装载模板", "批次与 VIN 明细"],
        ),
        step(
          "路线能力回压",
          "容量校验",
          [
            { label: "中轴干线容量", value: "650 台" },
            { label: "保护对象", value: "620 台已确认订单" },
          ],
          "逐路线检查，不用全国总运力抵消局部不足；先调整异常缓冲，再机动库存，最后普通补货。",
          delivery.issues.length
            ? `${delivery.issues.length} 项阻断待处理。`
            : "当前通过；可模拟中轴容量减 80 台查看受影响 VIN。",
          ["已确认路线板位", "补货调整优先级"],
        ),
        step(
          "输出联合计划",
          "执行准备",
          [
            { label: "预算", value: `${number(cost)} SAR` },
            { label: "批次归属", value: "每个 VIN 唯一" },
          ],
          "分车与物流使用同一版本；只有数量、路线容量和批次检查通过才能进入执行。",
          `本轮状态：${delivery.status === "ready" ? "具备执行条件" : "待处理阻断"}。`,
          [delivery.id, "运输任务发布规则"],
        ),
      ],
    };
  }
  if (command === "/daily-rebalance") {
    const dailyPlan = rebalanceDailyOrders(state, businessDate);
    const candidateCount = dailyPlan.candidates.length;
    const eligible = dailyPlan.orders
      .flatMap((order) => evaluateOrderSources(dailyPlan, order.id))
      .filter((item) => item.eligible).length;
    const enterprise = dailyPlan.orders.find(
      (order) => order.type === "enterprise",
    );
    const enterpriseSources = dailyPlan.candidates.filter(
      (item) => item.orderId === enterprise?.id,
    );
    const combinedCost = enterpriseSources.reduce(
      (sum, source) => sum + source.cost,
      0,
    );
    return {
      kind: "rebalance",
      objective: "满足新订单，同时保护来源库存、贡献利润和既有承诺。",
      conclusion: `${dailyPlan.orders.length} 笔订单，${candidateCount} 个候选；${candidateCount - eligible} 个候选因执行条件不足被排除。`,
      dailyPlan,
      steps: [
        step(
          "读入今日订单与车源",
          "数据读取",
          [
            { label: "订单日期", value: businessDate },
            {
              label: "可售 VPC 库存",
              value: `${state.inventoryBaseline?.positions.filter((item) => item.status === "available").length ?? 0} 台`,
            },
          ],
          "以到港签收形成的库存为基线；在途船次不等同于当前可售资源。",
          `${dailyPlan.orders.length} 笔订单进入本轮匹配。`,
          ["门店订单池", "T+3 签收库存基线", "门店与车商车源登记"],
        ),
        step(
          "先排除不可执行车源",
          "硬约束过滤",
          [
            { label: "候选总数", value: String(candidateCount) },
            { label: "通过执行条件", value: String(eligible) },
          ],
          "先校验 VIN 是否被占用、权属与授权、数量、客户交期，再比较成本。低报价不能绕过交易条件。",
          `${candidateCount - eligible} 个候选待条件关闭；不参与可执行方案审批。`,
          ["VIN 占用账本", "车辆权属与回购授权", "客户承诺时间"],
        ),
        step(
          "组合企业大单车源",
          "组合计算",
          enterpriseSources.map((item) => ({
            label: item.location,
            value: `${item.vehicleIds.length} 台 / ${number(item.cost)} SAR`,
          })),
          "本地优先，但不抽空一个来源；三地组合需整单齐套，且审批前再次检查 VIN 可用性。",
          `企业整单增量成本 ${number(combinedCost)} SAR；净贡献 ${number((enterprise?.margin ?? 0) - combinedCost)} SAR。`,
          ["80 台 Hilux 合同", "来源安全覆盖策略", "分来源报价"],
        ),
        step(
          "按订单选择运输策略",
          "经济性比较",
          [
            { label: "高利润 LX", value: "同城门店 vs 车商回购" },
            { label: "普通 / 偏远", value: "本地班次 / 区域拼单" },
          ],
          "净贡献 = 订单毛利 − 增量物流及回购成本；保留承诺内方案，再比较来源端影响。",
          "LX 同城调拨；Camry 本地短驳；8 台 Hilux 并入塔布克周班。",
          ["订单贡献毛利", "班次运价", "门店调出后覆盖"],
        ),
        step(
          "提交审批与锁车",
          "执行校验",
          [
            {
              label: "待审批事项",
              value: String(
                dailyPlan.decisions.filter(
                  (item) => item.status === "approval_required",
                ).length,
              ),
            },
            { label: "审批后动作", value: "锁 VIN → 生成运输任务" },
          ],
          "批准时重新检查数量、权属和全局 VIN 占用；历史任务使用的门店车源不能重复调拨。",
          "企业组合与门店调拨等待负责人确认；未确权回购不可执行。",
          [dailyPlan.id, "全局 VIN 唯一占用规则"],
        ),
      ],
    };
  }
  if (command === "/crisis-brief") {
    const crisis = analyzeCrisis(state);
    return {
      kind: "crisis",
      objective: "识别单港网络变化，并确定分车与物流联合决策的范围。",
      conclusion: "东部订单取消固定 VPC 归属；分车与干线能力需要一起决策。",
      steps: [
        step(
          "建立分析边界",
          "数据读取",
          [
            { label: "船次", value: state.vessel.name },
            { label: "计划窗口", value: "T-14 → T+3" },
          ],
          "锁定同一船次与时间窗口，避免把后续船次作为本船可用供给。",
          "以本船 VIN 和客户承诺为分析边界。",
          [manifest, "到港计划"],
        ),
        step(
          "读取船次与需求",
          "供需核对",
          [
            { label: "供给", value: `${crisis.vesselQuantity} 台` },
            {
              label: "已预订 / 自由库存",
              value: `${crisis.reservedQuantity} / ${crisis.inventoryQuantity} 台`,
            },
          ],
          "区分已有承诺和可重新配置的库存；补货不能挤占订单。",
          "建立订单保护池与库存补充池。",
          [manifest, "销售订单快照", "三 VPC 库存快照"],
        ),
        step(
          "检查网络约束",
          "约束校验",
          [
            {
              label: "达曼港",
              value: crisis.dammamPortAvailable ? "可用" : "不可用",
            },
            { label: "入境节点", value: "吉达港" },
          ],
          "不可用港口从路径候选中移除；VPC 可用不意味着其入境港仍可用。",
          "全部 1,800 台只能从吉达入境，达曼 VPC 仍作为库存节点。",
          ["港口可用性记录", "VPC 节点登记"],
        ),
        step(
          "对比双港与单港",
          "网络比较",
          [
            { label: "东向运输压力", value: `${crisis.eastboundPressure} 台` },
            { label: "风险项", value: String(crisis.risks.length) },
          ],
          "比较最终交付路径与固定母库路径，检查重复装卸、折返与东向运力。",
          crisis.risks.map((risk) => risk.label).join("；"),
          ["原双港网络", "单港候选路径", "演示路线需求"],
        ),
        step(
          "形成危机简报",
          "执行建议",
          [{ label: "联动对象", value: "分车 · 干线 · 库存节点" }],
          "明确订单穿透直达、利雅得截流与达曼安全库存的边界，再分别校验数量和容量。",
          crisis.comparison.optimized.join("；"),
          ["网络比较结果", "单港保障策略"],
        ),
      ],
    };
  }
  const plan = state.deliveryPlan;
  const reserved = state.vessel.vehicles.filter(
    (vehicle) => vehicle.pool === "reserved",
  ).length;
  const total = state.vessel.vehicles.length;
  const lastArrival = Math.max(
    0,
    ...(plan?.batches.map((batch) => batch.arrivalDay) ?? []),
  );
  return {
    kind: "execution",
    objective: "按事件推进车辆状态，仅在全部到达终态后开放库存。",
    conclusion: `订单交付 ${reserved} 台，VPC 库存 ${number(total - reserved)} 台，形成每日调拨基线。`,
    steps: [
      step(
        "读取联合计划",
        "数据读取",
        [
          { label: "计划", value: plan?.id ?? "缺失" },
          { label: "批次", value: `${plan?.batches.length ?? 0} 个` },
        ],
        "仅已发布且容量校验通过的计划可以执行；批次沿用本轮唯一 VIN 归属。",
        "载入路线、批次和发运/收货窗口。",
        [plan?.id ?? "联合计划", "VIN 配载表"],
      ),
      step(
        "滚装船到港",
        "事件推进",
        [
          { label: "到港日", value: "T0" },
          { label: "车辆", value: `${total} 台` },
        ],
        "到港事件幂等处理；到港不等于清关完成，也不等于可售库存。",
        "演示注入 arrive 事件，开启港口作业。",
        [manifest, "到港事件记录"],
      ),
      step(
        "清关与 PDI",
        "状态校验",
        [
          { label: "批次释放", value: "按 VIN 校验" },
          { label: "装车前置", value: "clear → pdi" },
        ],
        "未清关或未完成 PDI 的车辆不能装车；逐 VIN 推进，不用汇总数字替代状态。",
        "演示按 clear / pdi 事件释放本船车辆。",
        ["清关事件", "PDI 事件", "车辆状态机"],
      ),
      step(
        "执行发运",
        "任务推进",
        [
          { label: "运输任务", value: `${plan?.batches.length ?? 0} 个` },
          { label: "最后到达日", value: `T+${lastArrival}` },
        ],
        "按发布批次发运；每台 VIN 唯一绑定 batchId，随 ship / receive 事件更新。",
        "演示按各班次时序推进装车、在途和签收。",
        ["运输任务表", "班次发运与签收事件"],
      ),
      step(
        "检查局部异常",
        "异常边界",
        [
          { label: "可重排对象", value: "尚未发运的受影响车辆" },
          { label: "重复事件", value: "幂等忽略" },
        ],
        "不重新分配已签收 VIN；局部异常只影响未发运批次。当前演示不注入异常事件。",
        "保留已执行归属，检查重复签收与无效状态转换。",
        ["执行事件账本", "局部重排规则"],
      ),
      step(
        "核对最终状态",
        "守恒校验",
        [
          { label: "订单交付", value: `${reserved} 台` },
          { label: "库存入库", value: `${number(total - reserved)} 台` },
        ],
        "终态总量必须等于船次 VIN 总量；存在未到货车辆时不能关闭执行。",
        `目标终态：${reserved} + ${total - reserved} = ${number(total)} 台。关闭时重新核验。`,
        ["批次签收记录", "VIN 唯一占用规则"],
      ),
      step(
        "形成库存基线",
        "库存更新",
        [
          { label: "可售资源", value: "仅库存池已签收车辆" },
          { label: "每日运营", value: "T+4 起" },
        ],
        "关闭到港执行后，库存池转成 available；订单交付车不重复进入可售库存。",
        `完成事件与守恒校验后形成 ${number(total - reserved)} 台库存基线。`,
        ["签收库存基线", "每日订单调拨入口"],
      ),
    ],
  };
}

export type EvaluatedSource = SourceCandidate & {
  eligible: boolean;
  exclusionReason: string;
  netContribution: number;
  contributionLabel: string;
};
