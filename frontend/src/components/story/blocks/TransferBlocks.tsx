"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
  Store,
  Truck,
} from "lucide-react";
import type {
  CampaignState,
  DailyPlan,
  StoryBlock,
} from "@/lib/story/types";
import { transferDualImpact, transferException } from "@/lib/story/daily-transfer-run";
import { FactCard, MetricGrid, MiniBar, SectionGrid, StatusPill } from "../shared";

function currentPlan(
  block: StoryBlock,
  campaign: CampaignState,
): DailyPlan | undefined {
  const snapshot = block.data.plan as DailyPlan | undefined;
  return (
    campaign.dailyOperations.find(
      (plan) => plan.businessDate === snapshot?.businessDate,
    ) ?? snapshot
  );
}

export default function TransferBlocks({
  block,
  campaign,
  onApprove,
  canApprove = true,
}: {
  block: StoryBlock;
  campaign: CampaignState;
  onApprove: (decisionId: string) => void;
  canApprove?: boolean;
}) {
  const plan = currentPlan(block, campaign);
  const dualImpact =
    (block.data.dualImpact as typeof transferDualImpact | undefined) ??
    transferDualImpact;
  const exception =
    (block.data.exception as typeof transferException | undefined) ??
    transferException;
  if (block.type === "transfer-demand-pool") {
    const statusLabel = {
      enterprise: "缺车 · 需多地集结",
      premium: "分到车但交期不达",
      retail: "本地 VPC 覆盖",
      remote: "已被在途周班覆盖",
    } as const;
    const priorityLabel = {
      enterprise: "P1",
      premium: "P1",
      retail: "P2",
      remote: "P2",
    } as const;
    const typeLabel = {
      enterprise: "企业大单",
      premium: "高利润急单",
      retail: "普通零售",
      remote: "偏远地区",
    } as const;
    return (
      <div className="story-data-table daily" data-testid="transfer-demand-pool">
        <div>
          <span>订单</span>
          <span>优先级</span>
          <span>需求</span>
          <span>覆盖状态</span>
        </div>
        {(plan?.orders ?? []).map((order) => (
          <article key={order.id}>
            <strong>{order.id}</strong>
            <span>
              {priorityLabel[order.type]} · {typeLabel[order.type]}
            </span>
            <span>
              {order.quantity} × {order.model}
            </span>
            <span>{statusLabel[order.type]}</span>
          </article>
        ))}
      </div>
    );
  }
  if (block.type === "transfer-dual-impact") {
    const stores = [
      { key: "nearby", label: "最近车源", data: dualImpact.nearby, exception: true },
      { key: "farther", label: "稍远车源 · 推荐", data: dualImpact.farther, exception: false },
    ];
    return (
      <div className="story-dual-impact" data-testid="transfer-dual-impact">
        {stores.map((item) => (
          <article key={item.key} className={item.exception ? "exception" : ""}>
            <header>
              <Store size={17} />
              <strong>{item.data.store}</strong>
              <StatusPill tone={item.exception ? "red" : "green"}>
                {item.exception ? "例外 · 待供应链负责人确认" : item.label}
              </StatusPill>
            </header>
            <dl>
              <div>
                <dt>同配置自由库存</dt>
                <dd>{item.data.freeStock} 台</dd>
              </div>
              <div>
                <dt>有效订单 / 销速</dt>
                <dd>
                  {item.data.activeOrders} 笔 · {item.data.weeklySales}
                </dd>
              </div>
              <div>
                <dt>调出前 → 调出后覆盖</dt>
                <dd>
                  {item.data.coverBefore} → {item.data.coverAfter}
                </dd>
              </div>
              <div>
                <dt>下一批确认到货</dt>
                <dd>{item.data.nextArrival}</dd>
              </div>
            </dl>
            {item.exception && (
              <p>
                调出后跌破 {dualImpact.safetyWeeks} 周安全线，不调出；改用
                {dualImpact.farther.store}车源。
              </p>
            )}
          </article>
        ))}
      </div>
    );
  }
  if (block.type === "transfer-exception-replan")
    return (
      <div className="story-exception-replan" data-testid="transfer-exception-replan">
        <div>
          <AlertTriangle size={22} />
          <strong>
            异常：{exception.event}（VIN {exception.vin}）
          </strong>
          <p>{exception.withdrawn}，失效建议已撤回。</p>
        </div>
        <div>
          <FileCheck2 size={22} />
          <strong>重新匹配：{exception.replacement} 补位</strong>
          <p>
            {exception.arrivalShift} · {exception.costDelta} ·{" "}
            {exception.pending}。{exception.retained}。
          </p>
        </div>
      </div>
    );
  if (!plan) return <p>正在建立今日调拨方案…</p>;
  const enterpriseOrder = plan.orders.find((item) => item.type === "enterprise");
  const premiumOrder = plan.orders.find((item) => item.type === "premium");
  const enterprise = plan.decisions.find(
    (item) => item.orderId === enterpriseOrder?.id,
  );
  const premium = plan.decisions.find(
    (item) => item.orderId === premiumOrder?.id,
  );
  const enterpriseSources = plan.candidates.filter(
    (candidate) => candidate.orderId === enterpriseOrder?.id,
  );
  if (block.type === "transfer-enterprise-assembly") {
    const assembled = enterpriseSources.reduce(
      (sum, source) => sum + source.vehicleIds.length,
      0,
    );
    return (
      <div data-testid="transfer-enterprise-assembly">
        <div className="story-assembly">
          {enterpriseSources.map((source, index) => (
            <span className="story-assembly-part" key={source.id}>
              <article>
                <span>{source.location}</span>
                <strong>{source.vehicleIds.length}</strong>
                <small>
                  {source.leadDays} 天 · {source.cost.toLocaleString()} SAR
                </small>
              </article>
              {index < enterpriseSources.length - 1 && <b>+</b>}
            </span>
          ))}
          <em>= {enterpriseOrder?.quantity ?? 0} 台</em>
        </div>
        <div className="story-decision-list">
          <p>
            <CheckCircle2 size={16} /> 可按期交付 {assembled} /{" "}
            {enterpriseOrder?.quantity ?? 0} 台，剩余缺口 0；组合后来源覆盖仍为
            18 / 17 / 10 天。
          </p>
          <p>
            <AlertTriangle size={16} /> 受影响原计划：DMM VPC 安全水位以上 16
            台调出后由下一船补回；授权车商回购候选待商务财务确认，未计入方案。
          </p>
        </div>
      </div>
    );
  }
  if (block.type === "transfer-tradeoff")
    return (
      <div className="story-tradeoff" data-testid="transfer-tradeoff">
        <article className="recommended">
          <StatusPill>推荐 · 同城调拨</StatusPill>
          <strong>高价值急单 · 1 台 Lexus LX</strong>
          <p>利雅得旗舰店 → 客户，48 小时内到店，调出后仍有 3 天覆盖。</p>
          <MiniBar label="增量运费" value={2_800} total={46_000} color="amber" />
          <MiniBar label="保住订单毛利" value={46_000} total={46_000} />
        </article>
        <article>
          <StatusPill tone="slate">普通订单 · 三选一</StatusPill>
          <strong>1 台 Camry · 达曼</strong>
          <ul>
            <li>
              <Truck size={13} /> 既有班次拼载 · 到店 +1 天 · 950 SAR（建议）
            </li>
            <li>
              <ArrowLeftRight size={13} /> 替代配置协商 · 到店当天 · 0 SAR
            </li>
            <li>
              <CheckCircle2 size={13} /> 等待已确认到货 · 到店 +4 天 · 0 SAR
            </li>
          </ul>
          <small>跨区专车 4,100 SAR 超过订单毛利，不建议。</small>
        </article>
      </div>
    );
  if (block.type === "transfer-execution-docs") {
    const locked =
      campaign.inventoryBaseline?.positions.filter(
        (position) => position.status === "locked",
      ).length ?? 0;
    return (
      <div data-testid="transfer-execution-docs">
        <SectionGrid columns={3}>
          <FactCard eyebrow="TRANSFER ORDER" title="调拨单">
            <p>RUH 40 + JED 24 + DMM 16 → 企业客户交付点，关联 80 台 VIN。</p>
          </FactCard>
          <FactCard eyebrow="BUYBACK ORDER" title="回购单" tone="amber">
            <p>授权车商 1 台 LX：报价、权属与结算待商务财务确认。</p>
          </FactCard>
          <FactCard eyebrow="TRANSPORT TASKS" title="运输任务">
            <p>
              {plan.executionTasks.length
                ? `${plan.executionTasks.length} 个任务已释放 · ${locked} 台已锁定`
                : "批准后生成运输任务并锁定库存。"}
            </p>
          </FactCard>
        </SectionGrid>
        <div className="story-approval-list">
          {plan.decisions
            .filter((decision) => decision.status !== "proposed")
            .map((decision) => (
              <article key={decision.id}>
                <div>
                  <span>{decision.orderId}</span>
                  <strong>{decision.rationale}</strong>
                </div>
                {decision.status === "approved" ? (
                  <StatusPill>
                    <CheckCircle2 size={12} /> 已批准
                  </StatusPill>
                ) : decision.status === "approval_required" && canApprove ? (
                  <button
                    type="button"
                    data-testid={
                      decision.id === enterprise?.id
                        ? "approve-enterprise"
                        : decision.id === premium?.id
                          ? "approve-premium"
                          : "approve-decision"
                    }
                    onClick={() => onApprove(decision.id)}
                  >
                    批准方案
                  </button>
                ) : (
                  <StatusPill tone="slate">历史方案 · 只读</StatusPill>
                )}
              </article>
            ))}
          <article>
            <div>
              <span>BUYBACK</span>
              <strong>授权车商回购：确认车辆权属 · 确认回购价格 · 完成付款授权</strong>
            </div>
            <button type="button" disabled data-testid="transfer-buyback-disabled">
              待商务财务确认
            </button>
          </article>
        </div>
        {plan.executionTasks.length > 0 && (
          <p className="story-inline-note">
            <LockKeyhole size={14} /> 库存已从 available 更新为
            locked，同一车辆不会被重复占用。
          </p>
        )}
      </div>
    );
  }
  return (
    <div data-testid="transfer-value-summary">
      <MetricGrid
        items={[
          {
            label: "获得可执行方案",
            value: "3 / 4 笔",
            note: "企业大单 · 急单 · 普通单",
            tone: "green",
          },
          {
            label: "增量费用 vs 保护贡献",
            value: "4.36 万 / 5.1 万 SAR",
            note: "运费与拼载 vs 保住毛利",
          },
          {
            label: "安全线例外",
            value: "1 项",
            note: "北环店不调出 · T+9 补回",
            tone: "amber",
          },
          {
            label: "未满足缺口",
            value: "0",
            note: "异常 1 起已局部重排",
            tone: "green",
          },
        ]}
      />
      <p className="story-inline-note">
        <LockKeyhole size={14} />{" "}
        回购候选未确认前不计入履约结果；所有数量与费用可追溯到订单、车辆与方案版本。
      </p>
    </div>
  );
}
