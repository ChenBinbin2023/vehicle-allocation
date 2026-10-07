"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import {
  ArrowRight,
  CheckCircle2,
  Gauge,
  PackageOpen,
  Route,
  Truck,
} from "lucide-react";
import type { CampaignState, RouteId, StoryBlock } from "@/lib/story/types";
import {
  FactCard,
  MetricGrid,
  MiniBar,
  SectionGrid,
  StatusPill,
} from "../shared";

const routeMeta: Array<[RouteId, string, string]> = [
  ["west", "西部短链", "JED → 西部"],
  ["riyadh", "利雅得中轴", "JED → RUH"],
  ["eastDirect", "东部订单直达", "JED → 东部交付点"],
  ["riyadhIntercept", "利雅得截流", "JED → RUH → 中东部"],
  ["dammamSafety", "达曼安全库存", "JED → DMM VPC"],
];
function routes(block: StoryBlock) {
  return (block.data.routes ?? {
    west: 520,
    riyadh: 650,
    eastDirect: 360,
    riyadhIntercept: 170,
    dammamSafety: 100,
  }) as Record<RouteId, number>;
}

export default function DeliveryBlocks({
  block,
  campaign,
}: {
  block: StoryBlock;
  campaign: CampaignState;
}) {
  const { t: translateText } = useI18n();

  const routeCounts = routes(block);
  if (block.type === "release-rhythm")
    return (
      <div className="story-release">
        <article>
          <span>D1</span>
          <strong>630</strong>
          <p>{translateText("订单保护与西部短链")}</p>
        </article>
        <i />
        <article>
          <span>D2</span>
          <strong>760</strong>
          <p>{translateText("利雅得中轴与东向直达")}</p>
        </article>
        <i />
        <article>
          <span>D3</span>
          <strong>410</strong>
          <p>{translateText("截流短驳与安全库存")}</p>
        </article>
      </div>
    );
  if (block.type === "route-network")
    return (
      <div className="story-route-grid" data-testid="route-counts">
        {routeMeta.map(([id, label, path], index) => (
          <article key={id}>
            <span>0{index + 1}</span>
            <Route size={16} />
            <strong>{routeCounts[id]}</strong>
            <h3>{translateText(label)}</h3>
            <p>{translateText(path)}</p>
          </article>
        ))}
      </div>
    );
  if (block.type === "truck-loads")
    return (
      <>
        <MetricGrid
          items={[
            {
              label: "板车批次",
              value: String(
                block.data.batchCount ??
                  campaign.deliveryPlan?.batches.length ??
                  227,
              ),
              note: "8 位轿运车 · 路线内配载",
            },
            {
              label: "车辆",
              value: "1,800",
              note: "每台车唯一 batchId",
              tone: "green",
            },
            {
              label: "预计装载率",
              value: "99.1%",
              note: "末班允许非满载",
              tone: "green",
            },
          ]}
        />
        <div className="story-truck-strip">
          <Truck size={22} />
          <i>
            <b style={{ width: "99.1%" }} />
          </i>
          <span>{translateText("计划容量 1,816 · 使用 1,800")}</span>
        </div>
      </>
    );
  if (block.type === "capacity-board")
    return (
      <div className="story-bars">
        {routeMeta.map(([id, label]) => (
          <MiniBar
            key={id}
            label={label}
            value={routeCounts[id]}
            total={routeCounts[id]}
            color={id === "dammamSafety" ? "amber" : "green"}
          />
        ))}
      </div>
    );
  if (block.type === "order-logistics")
    return (
      <div className="story-data-table logistics">
        <div>
          <span>{translateText("订单类型")}</span>
          <span>{translateText("首选方案")}</span>
          <span>{translateText("保护逻辑")}</span>
          <span>{translateText("承诺")}</span>
        </div>
        <article>
          <strong>{translateText("企业大单")}</strong>
          <span>{translateText("多批次直达")}</span>
          <span>{translateText("同目的地成组")}</span>
          <StatusPill>D+3</StatusPill>
        </article>
        <article>
          <strong>{translateText("高配车")}</strong>
          <span>{translateText("低装卸优先")}</span>
          <span>{translateText("配置与车况保护")}</span>
          <StatusPill>D+3</StatusPill>
        </article>
        <article>
          <strong>{translateText("普通订单")}</strong>
          <span>{translateText("区域既有班次")}</span>
          <span>{translateText("不开亏损专车")}</span>
          <StatusPill tone="slate">D+2/3</StatusPill>
        </article>
        <article>
          <strong>{translateText("VPC 补货")}</strong>
          <span>{translateText("利雅得截流")}</span>
          <span>{translateText("安全库存优先")}</span>
          <StatusPill tone="amber">D+3</StatusPill>
        </article>
        <article>
          <strong>{translateText("偏远地区")}</strong>
          <span>{translateText("区域拼单")}</span>
          <span>{translateText("满载后发运")}</span>
          <StatusPill tone="slate">{translateText("班期制")}</StatusPill>
        </article>
      </div>
    );
  if (block.type === "cost-compare")
    return (
      <SectionGrid columns={3}>
        <FactCard
          eyebrow="1 HANDLING"
          title={translateText("订单穿透直达")}
          tone="green"
        >
          <p>
            {translateText(
              "减少 VPC 二次装卸；按全程报价与承诺期比较，而不是只看干线价。",
            )}
          </p>
        </FactCard>
        <FactCard eyebrow="1 HANDLING" title={translateText("利雅得中轴")}>
          <p>{translateText("适合规模化补库与全国机动库存。")}</p>
        </FactCard>
        <FactCard
          eyebrow="2 HANDLINGS"
          title={translateText("截流后短驳")}
          tone="amber"
        >
          <p>{translateText("以更低干线成本覆盖中东部过渡带。")}</p>
        </FactCard>
      </SectionGrid>
    );
  if (block.type === "logistics-pressure") {
    const issues = (block.data.issues ?? []) as Array<{ message: string }>;
    return (
      <div className="story-pressure">
        <Gauge size={24} />
        <div>
          <strong>
            {translateText(
              issues.length
                ? `${issues.length} 项阻断待处理`
                : "当前没有阻断性容量缺口",
            )}
          </strong>
          <p>
            {translateText(
              issues.length
                ? issues.map((issue) => issue.message).join("；")
                : "若东向容量下降，先回压机动与异常缓冲 VIN，不触碰 620 台已确认订单。",
            )}
          </p>
        </div>
        <StatusPill tone={issues.length ? "amber" : "green"}>
          {translateText(issues.length ? "计划不可执行" : "0 台待调整")}
        </StatusPill>
      </div>
    );
  }
  const blocked = block.data.status === "blocked";
  return (
    <div className="story-publish-check">
      <PackageOpen size={34} />
      <div>
        <span>JOINT PLAN</span>
        <strong>{translateText(`DELIVERY-v${block.inputVersion}`)}</strong>
        <p>
          {translateText(
            blocked
              ? "容量校验未通过。通过画布历史返回分车调整，或确认新增运力后重新计算。"
              : "分车守恒、路线容量、板车批次与收货窗口已校验",
          )}
        </p>
      </div>
      <ArrowRight size={16} />
      <StatusPill tone={blocked ? "amber" : "green"}>
        <CheckCircle2 size={12} />
        {translateText(
          blocked
            ? "未发布 · 阻断"
            : campaign.deliveryPlan?.status === "published"
              ? "已发布"
              : "校验完成 · 待发布",
        )}
      </StatusPill>
    </div>
  );
}
