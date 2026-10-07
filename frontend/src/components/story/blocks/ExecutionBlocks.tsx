"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import {
  CheckCircle2,
  CircleDot,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type { CampaignState, StoryBlock } from "@/lib/story/types";
import {
  FactCard,
  MetricGrid,
  MiniBar,
  SectionGrid,
  StatusPill,
} from "../shared";

export default function ExecutionBlocks({
  block,
  campaign,
}: {
  block: StoryBlock;
  campaign: CampaignState;
}) {
  const { t: translateText } = useI18n();

  if (block.type === "execution-timeline")
    return (
      <div className="story-execution-line">
        <article>
          <span>T0</span>
          <strong>{translateText("到港 / 清关")}</strong>
          <small>{translateText("1,800 台入场")}</small>
        </article>
        <i />
        <article>
          <span>T+1</span>
          <strong>{translateText("PDI / 首批装车")}</strong>
          <small>{translateText("西部与订单车")}</small>
        </article>
        <i />
        <article>
          <span>T+2</span>
          <strong>{translateText("干线在途")}</strong>
          <small>{translateText("利雅得中轴")}</small>
        </article>
        <i />
        <article>
          <span>T+3</span>
          <strong>{translateText("全部签收")}</strong>
          <small>{translateText("形成库存基线")}</small>
        </article>
      </div>
    );
  if (block.type === "customs-pdi")
    return (
      <div className="story-bars">
        <MiniBar label="船舶卸车" value={1800} total={1800} />
        <MiniBar label="清关放行" value={1800} total={1800} />
        <MiniBar label="PDI 完成" value={1800} total={1800} />
      </div>
    );
  if (block.type === "port-queue")
    return (
      <MetricGrid
        items={[
          { label: "待清关", value: "0", note: "全部放行", tone: "green" },
          { label: "待 PDI", value: "0", note: "全部完成", tone: "green" },
          {
            label: "待装板车",
            value: "0",
            note: "批次均已发运",
            tone: "green",
          },
        ]}
      />
    );
  if (block.type === "dispatch-board")
    return (
      <div className="story-dispatch">
        <Truck size={26} />
        <div>
          <strong>
            {campaign.deliveryPlan?.batches.length ?? 227} /{" "}
            {campaign.deliveryPlan?.batches.length ?? 227}
            {translateText(" 批次已签收")}
          </strong>
          <p>
            {translateText("所有批次按 route、batchId、释放日与收货窗口跟踪")}
          </p>
        </div>
        <StatusPill>100%</StatusPill>
      </div>
    );
  if (block.type === "transit-network")
    return (
      <div className="story-route-grid compact">
        <article>
          <span>WEST</span>
          <strong>520</strong>
          <h3>{translateText("西部已签收")}</h3>
        </article>
        <article>
          <span>CENTRAL</span>
          <strong>650</strong>
          <h3>{translateText("利雅得已签收")}</h3>
        </article>
        <article>
          <span>EAST</span>
          <strong>630</strong>
          <h3>{translateText("东向已签收")}</h3>
        </article>
      </div>
    );
  if (block.type === "order-delivery")
    return (
      <SectionGrid columns={3}>
        <FactCard eyebrow="ENTERPRISE" title="240 / 240" tone="green">
          <p>{translateText("企业交付中心签收")}</p>
        </FactCard>
        <FactCard eyebrow="RETAIL" title="290 / 290" tone="green">
          <p>{translateText("客户交付门店签收")}</p>
        </FactCard>
        <FactCard eyebrow="PREMIUM" title="90 / 90" tone="green">
          <p>{translateText("高价值客户交付完成")}</p>
        </FactCard>
      </SectionGrid>
    );
  if (block.type === "vpc-arrivals")
    return (
      <MetricGrid
        items={[
          { label: "吉达 VPC", value: "400", note: "西部补货与缓冲" },
          {
            label: "利雅得 VPC",
            value: "680",
            note: "中轴与截流库存",
            tone: "green",
          },
          {
            label: "达曼 VPC",
            value: "100",
            note: "东部安全库存",
            tone: "amber",
          },
        ]}
      />
    );
  if (block.type === "execution-exceptions")
    return (
      <div className="story-validation">
        <StatusPill>{translateText("无港损阻断")}</StatusPill>
        <StatusPill>{translateText("无重复签收")}</StatusPill>
        <StatusPill>{translateText("无未发运批次")}</StatusPill>
        <p>
          <CircleDot size={14} />
          {translateText(
            " 演示基线无异常；真实运行仅重排尚未发运的受影响车辆。",
          )}
        </p>
      </div>
    );
  if (block.type === "final-conservation")
    return (
      <div data-testid="final-conservation">
        <MetricGrid
          items={[
            {
              label: "总车辆",
              value: "1,800",
              note: "终态守恒",
              tone: "green",
            },
            { label: "订单交付", value: "620", note: "delivered" },
            { label: "VPC 入库", value: "1,180", note: "available" },
            {
              label: "在途 / 异常",
              value: "0",
              note: "无悬空 VIN",
              tone: "green",
            },
          ]}
        />
      </div>
    );
  return (
    <div className="story-baseline" data-testid="inventory-baseline">
      <ShieldCheck size={38} />
      <div>
        <span>T+3 · DAILY OPERATIONS BASELINE</span>
        <strong>{translateText("1,180 台可售 VPC 库存")}</strong>
        <p>
          {translateText(
            "吉达 400 · 利雅得 680 · 达曼 100；每日调拨 Skill 已解锁。",
          )}
        </p>
      </div>
      <PackageCheck size={24} />
    </div>
  );
}
