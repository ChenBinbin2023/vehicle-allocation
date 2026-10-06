"""Read-only conversion of the supplied CSV baselines. No scenario facts invented here."""
import csv,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
def read(path):
 with (root/'data'/path).open(encoding='utf-8-sig') as f:return list(csv.DictReader(f))
def n(row,key):return float(row[key]) if row[key] else None
stores=[dict(id=r['门店编码'],name=r['门店名称'],region=r['地理大区'],city=r['城市'],cityCode=r['城市编码'],channel=r['客户类型'],brands=r['经营品牌'],account=r['交易身份编码']) for r in read('00_客户/门店主数据.csv')]
stock=[dict(store=r['门店编码'],brand=r['品牌'],physical=n(r,'当前实物库存(台)'),free=n(r,'可自由分配库存(台)'),locked=n(r,'订单已锁库存(台)'),frozen=n(r,'质检冻结库存(台)'),transit=n(r,'在途库存(台)'),gap=n(r,'参考补库缺口(台)'),weekly=n(r,'参考周销速(台)'),target=n(r,'目标库存覆盖(周)')) for r in read('03_库存/当前库存_门店.csv')]
months=[dict(month=r['月份'],toyota=n(r,'丰田销量代理(台)'),lexus=n(r,'雷克萨斯销量推估(台)')) for r in read('01_供给/按月总表.csv')]
scenarios=[dict(id=r['场景编码'],capacity=n(r,'有效周运力(台)'),trucks=n(r,'运输车辆合计(辆)'),demand=n(r,'参考周运输需求(台)'),gap=n(r,'全网净缺口(台)'),routeGap=n(r,'各路线缺口合计(台)'),km=n(r,'需求加权平均公里数(km)'),cost=n(r,'需求加权满载单台运费(SAR)')) for r in read('04_运力/场景运力汇总.csv')]
routes=[dict(scenario=r['场景编码'],id=r['路线编码'],capacity=n(r,'有效周运力(台)'),demand=n(r,'参考周运输需求(台)'),gap=n(r,'周运力缺口(台)'),trucks=n(r,'分配运输车辆数(辆)'),cost=n(r,'整趟费用(SAR)')) for r in read('04_运力/场景路线运力.csv')]
out=root/'frontend/src/lib/data.json';out.write_text(json.dumps(dict(stores=stores,stock=stock,months=months,scenarios=scenarios,routes=routes),ensure_ascii=False,separators=(',',':')))
print(f'Imported {len(stores)} stores, {len(stock)} inventory rows, {len(months)} months, {len(routes)} scenario routes.')
# Analysis details retain the source grain; model expansion lives in the engine.
from collections import defaultdict
monthly=defaultdict(float)
for r in read('02_销速/月度门店销量.csv'):
 monthly[(r['月份'],r['品牌'],r['客户类型'])]+=n(r,'月销量(台)') or 0
analysis=dict(
 snapshot='H_MOCK_20260929_V1',stockDate='2026-09-29',
 velocity=[dict(store=r['门店编码'],brand=r['品牌'],start=r['统计起始日'],end=r['统计截止日'],days=n(r,'统计天数'),age=n(r,'统计截止至快照间隔(天)')) for r in read('02_销速/销速汇总_门店.csv')],
 ages=[dict(store=r['门店编码'],brand=r['品牌'],aged=n(r,'库龄91天及以上(台)')) for r in read('03_库存/当前库存_门店.csv')],
 sales=[dict(month=k[0],brand=k[1],channel=k[2],qty=v) for k,v in sorted(monthly.items())],
 routeDetails=[dict(id=r['路线编码'],origin=r['始发节点'],city=r['目的城市'],region=r['目的大区'],km=n(r,'单程公里数(km)'),hours=n(r,'单程运输时长(小时)'),load=n(r,'每车次装载量(台)')) for r in read('04_运力/路线主数据.csv')],
 mapping=[dict(store=r['门店编码'],route=r['路线编码'],dual=r['双港口推荐路线'],west=r['仅西部单港口推荐路线']) for r in read('04_运力/门店路线映射.csv')],
 routePeriods=[dict(scenario=r['场景编码'],route=r['路线编码'],start=r['运力周开始'],end=r['运力周结束'],trips=n(r,'计划周车次')) for r in read('04_运力/场景路线运力.csv')]
)
(root/'frontend/src/lib/analysis-data.json').write_text(json.dumps(analysis,ensure_ascii=False,separators=(',',':')))

# Smart query keeps store-level monthly facts, rather than using channel totals
# for regional drill-downs. Missing source months remain missing.
query=dict(
 snapshot='H_MOCK_20260929_V1',stockDate='2026-09-29',
 stores=stores, stock=stock, months=months,
 sales=[dict(month=r['月份'],store=r['门店编码'],brand=r['品牌'],qty=n(r,'月销量(台)')) for r in read('02_销速/月度门店销量.csv')],
 ages=analysis['ages'],
 routes=[dict(id=r['路线编码'],originId=r['始发节点编码'],origin=r['始发节点'],city=r['目的城市'],km=n(r,'单程公里数(km)'),hours=n(r,'单程运输时长(小时)'),load=n(r,'每车次装载量(台)')) for r in read('04_运力/路线主数据.csv')],
 mapping=analysis['mapping'],scenarioRoutes=routes,
)
(root/'frontend/src/lib/query-data.json').write_text(json.dumps(query,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Smart query imported {len(query["sales"])} monthly store/brand facts.')

# Product planning reads exactly the supplied store × brand grain.
planning=dict(
 snapshot=query['snapshot'], stockDate=query['stockDate'], nature='模拟数据',
 stores=[dict(**s,capacity=n(r,'库容上限(台)')) for s,r in zip(stores,read('00_客户/门店主数据.csv'))],
 stock=stock,
 velocity=[dict(store=r['门店编码'],brand=r['品牌'],weekly=n(r,'平均周销量(台)'),start=r['统计起始日'],end=r['统计截止日'],basis=r['销速计算口径']) for r in read('02_销速/销速汇总_门店.csv')],
 routes=[dict(**r,tripCost=n(raw,'标准整趟费用(SAR)')) for r,raw in zip(query['routes'],read('04_运力/路线主数据.csv'))],
 mapping=analysis['mapping'],scenarioRoutes=routes,
)
(root/'frontend/src/lib/store-planning-data.json').write_text(json.dumps(planning,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Product planning imported {len(planning["stock"])} store/brand baselines.')

# Financial data is newly authored, explicitly simulated and isolated from baseline facts.
profit=dict(nature='新增模拟情景_非实际财务数据',currency='SAR',storageDays=3,
 models=[dict(brand=r['品牌'],model=r['车型'],unitPrice=n(r,'未税单价(SAR)'),discount=n(r,'单台折扣(SAR)'),purchase=n(r,'采购成本(SAR)'),commissionPct=n(r,'佣金率(%)'),other=n(r,'其他单台费用(SAR)')) for r in read('05_利润/车型利润情景.csv')],
 rates={r['费用编码']:n(r,'单台费率(SAR)') for r in read('05_利润/物流补充费用情景.csv')})
(root/'frontend/src/lib/profit-data.json').write_text(json.dumps(profit,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Profit simulation imported {len(profit["models"])} model assumptions; not actual finance records.')
