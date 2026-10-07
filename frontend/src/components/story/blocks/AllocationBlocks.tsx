"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { CheckCircle2, FileWarning, MapPin, ShieldCheck } from "lucide-react";
import type {
  AllocationAssignment,
  CampaignState,
  StoryBlock,
} from "@/lib/story/types";
import {
  FactCard,
  MetricGrid,
  MiniBar,
  SectionGrid,
  StatusPill,
} from "../shared";

function sample(block: StoryBlock) {
  return (block.data.sample ?? []) as AllocationAssignment[];
}

export default function AllocationBlocks({
  block,
  campaign,
  canChangeDammamSafety = false,
  onChangeDammamSafety,
}: {
  block: StoryBlock;
  campaign: CampaignState;
  canChangeDammamSafety?: boolean;
  onChangeDammamSafety?: () => void;
}) {
  const { t: translateText } = useI18n();

  const totals = (block.data.vpcTotals ?? {}) as Record<string, number>;
  const jed = totals.JED ?? 400;
  const ruh = totals.RUH ?? 680;
  const dmm = totals.DMM ?? 100;
  if (block.type === "supply-guard")
    return (
      <MetricGrid
        items={[
          { label: "船次总供给", value: "1,800", note: "VIN 唯一性已确认" },
          {
            label: "冻结 / 不可分",
            value: "0",
            note: "当前演示无港损与合规冻结",
            tone: "green",
          },
          {
            label: "可进入分车",
            value: "1,800",
            note: "100% 可分配",
            tone: "green",
          },
        ]}
      />
    );
  if (block.type === "pool-overview")
    return (
      <div data-testid="allocation-pools">
        <MetricGrid
          items={[
            {
              label: "已预订订单池",
              value: "620",
              note: "34.4% · 承诺优先",
              tone: "green",
            },
            { label: "库存补充池", value: "1,180", note: "65.6% · 区域覆盖" },
          ]}
        />
        <div className="story-pool-split large">
          <i style={{ width: "34.4%" }} />
          <span>{translateText("订单 620")}</span>
          <em>{translateText("补库 1,180")}</em>
        </div>
      </div>
    );
  if (block.type === "order-breakdown")
    return (
      <SectionGrid columns={3}>
        <FactCard eyebrow="STRATEGIC" title={translateText("企业订单 · 240")}>
          <p>{translateText("吉达 40 · 利雅得 80 · 东部 120")}</p>
        </FactCard>
        <FactCard eyebrow="PAID" title={translateText("普通零售 · 290")}>
          <p>{translateText("客户承诺优先，含 30 台中东部过渡带")}</p>
        </FactCard>
        <FactCard
          eyebrow="HIGH MARGIN"
          title={translateText("高配高利润 · 90")}
        >
          <p>{translateText("保护配置、颜色和承诺交期")}</p>
        </FactCard>
      </SectionGrid>
    );
  if (block.type === "vpc-allocation")
    return (
      <SectionGrid columns={3}>
        <FactCard
          eyebrow="WEST"
          title={translateText(`吉达 VPC · ${jed}`)}
          tone="green"
        >
          <MiniBar label="补货 + 机动 + 缓冲" value={jed} total={1180} />
        </FactCard>
        <FactCard
          eyebrow="CENTRAL"
          title={translateText(`利雅得 VPC · ${ruh}`)}
          tone="green"
        >
          <MiniBar label="中轴 + 截流" value={ruh} total={1180} />
        </FactCard>
        <FactCard
          eyebrow="EAST"
          title={translateText(`达曼 VPC · ${dmm}`)}
          tone="amber"
        >
          <MiniBar label="安全库存" value={dmm} total={1180} color="amber" />
        </FactCard>
      </SectionGrid>
    );
  if (block.type === "coverage-change")
    return (
      <div className="story-coverage">
        <div>
          <MapPin size={16} />
          <span>{translateText("西部")}</span>
          <strong>{translateText("稳定")}</strong>
          <em>{translateText("吉达短链支撑")}</em>
        </div>
        <div>
          <MapPin size={16} />
          <span>{translateText("中部")}</span>
          <strong>{translateText("+ 机动量")}</strong>
          <em>{translateText("利雅得作为全国中轴")}</em>
        </div>
        <div>
          <MapPin size={16} />
          <span>{translateText("东部")}</span>
          <strong>{translateText("有条件")}</strong>
          <em>{translateText("订单直达 + 100 台安全库存")}</em>
        </div>
      </div>
    );
  if (block.type === "vin-table") {
    const rows = sample(block).length
      ? sample(block)
      : (campaign.allocation?.assignments.slice(0, 12) ?? []);
    return (
      <div className="story-data-table">
        <div>
          <span>VIN</span>
          <span>{translateText("归属池")}</span>
          <span>{translateText("需求")}</span>
          <span>{translateText("目的地")}</span>
        </div>
        {rows.slice(0, 6).map((item) => (
          <article key={item.vehicleId}>
            <strong>{translateText(item.vehicleId)}</strong>
            <span>
              {translateText(item.pool === "reserved" ? "订单" : "库存")}
            </span>
            <span>{translateText(item.demandId.replace("DEM-", ""))}</span>
            <span>{translateText(item.destination)}</span>
          </article>
        ))}
      </div>
    );
  }
  if (block.type === "allocation-exceptions")
    return (
      <div className="story-validation">
        <StatusPill>{translateText("数量守恒")}</StatusPill>
        <StatusPill>{translateText("VIN 无重复")}</StatusPill>
        <StatusPill>{translateText("需求均有归属")}</StatusPill>
        <StatusPill tone="amber">
          {translateText("等待物流容量校验")}
        </StatusPill>
        <p>
          <FileWarning size={15} />
          {translateText(" 当前无分车阻断项；物流回压发生时仅调整低优先补货。")}
        </p>
      </div>
    );
  return (
    <div
      className={`story-publish-check ${block.status === "stale" ? "stale" : ""}`}
    >
      <ShieldCheck size={34} />
      <div>
        <span>ALLOCATION DRAFT</span>
        <strong>
          {translateText(
            String(
              block.data.planId ??
                campaign.allocation?.id ??
                `ALLOC-v${block.inputVersion}`,
            ),
          )}
        </strong>
        <p>
          {translateText(
            block.status === "stale"
              ? "结果已失效，请从 CUI 重新运行 /vessel-allocation。"
              : "1,800 / 1,800 台已分配 · 下一步运行 /delivery-plan",
          )}
        </p>
      </div>
      {block.status === "stale" ? (
        <StatusPill tone="amber">{translateText("需重跑")}</StatusPill>
      ) : canChangeDammamSafety ? (
        <button
          type="button"
          data-testid="raise-dammam-safety"
          onClick={onChangeDammamSafety}
        >
          {translateText("达曼安全库存 100 → 120")}
        </button>
      ) : (
        <StatusPill tone="slate">{translateText("只读运行快照")}</StatusPill>
      )}
    </div>
  );
}
