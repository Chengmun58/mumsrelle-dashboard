# Project TODO

- [x] 将 overview-aggregate.json 到项目可部署的数据目录，并保持原始聚合字段兼容
- [x] 将 /api/dashboard 的销售周期计算、趋势、部门和异常状态逻辑迁移到 tRPC publicProcedure
- [x] 实现 Google Sheets CSO KIV 与 Signed Up 数据实时拉取，并固定 5 分钟缓存
- [x] 创建响应式持久侧边栏导航并高亮 Dashboard；Overview 作为数据源状态展示
- [x] 创建快捷日期、月份年份和自定义日期范围筛选，并显示当前/对比周期说明
- [x] 创建四项核心销售指标卡片，支持正负变化颜色与趋势箭头
- [x] 使用 Recharts 实现当前周期 vs 上一周期柱状图
- [x] 使用 Recharts 实现 Top 5 门店排名柱状图
- [x] 使用 Recharts 实现 12 个月滚动面积折线图
- [x] 使用 Recharts 实现 BODY、RETAIL PRODUCT、FACE 堆叠柱状图
- [x] 创建 CSO 面板，严格使用 Active KIV、Due Today、Overdue、New Leads、Signed Up 标签
- [x] 创建数据状态指示条，显示 CSO 刷新时间、Overview 最新日期和警告
- [x] 添加加载、空状态、错误状态和移动端响应式表现
- [x] 添加服务端单元测试，覆盖日期区间、销售汇总、5 分钟缓存和异常状态
- [x] 添加前端数据展示与关键筛选交互测试
- [x] 清理重复目录和无用静态副本，保留可部署项目所需文件
- [x] 运行类型检查、测试和生产构建
- [x] 完成桌面端与移动端浏览器视觉验证
- [x] 保存最终项目版本并提供可部署项目附件

- [x] 明确 Overview 为数据源状态展示，Dashboard 为当前导航高亮项
- [x] 提供门店级 Top 5 数据结构；当前快照仅有单一门店，界面明确降级说明
- [x] 补充首页整体 loading、无数据和图表空状态
- [x] 补充销售汇总、CSO 缓存命中/过期与异常 warning 服务端测试
- [x] 添加前端筛选交互测试，覆盖快捷日期、月份年份、自定义范围和刷新
- [x] 记录桌面端与移动端验收结论

- [x] 为 Outlet Comparison、部门收入图和 CSO 主面板补充明确的 empty/no-data UI
- [x] 扩展前端测试以覆盖快捷按钮、月份/年份、自定义日期和 Refresh 行为
- [x] 将桌面端与移动端验收检查项和结论写入 qa-acceptance.md

# Keyword Trend Dashboard Extension

- [ ] 读取并遵循自动化调度、连接器和关键词研究接入规范
- [ ] 确认 Google Search Console 作为主数据源的站点、日期粒度和刷新策略
- [ ] 确认 Ahrefs 或 Semrush 外部排名数据的可用连接器与字段映射
- [ ] 增加 CSV/JSON 关键词趋势离线导入与回退数据格式
- [ ] 增加关键词趋势 tRPC 服务，统一 GSC、外部排名和离线数据来源状态
- [ ] 实现自动刷新、缓存、最近刷新时间和失败回退提示
- [ ] 实现关键词趋势图表、排名变化、点击/展示/CTR/平均排名和筛选维度
- [ ] 增加数据源选择、日期范围、关键词、国家、设备和页面筛选
- [ ] 添加服务端测试，覆盖 GSC 映射、外部数据映射、离线回退、缓存和异常状态
- [ ] 添加前端测试，覆盖筛选、刷新按钮、自动刷新状态和来源提示
- [ ] 运行类型检查、测试、生产构建和自动刷新视觉验证
- [ ] 保存最终版本并交付关键词趋势模块

# Offline Keyword Trend Dashboard

- [x] 定义 CSV/JSON 统一字段契约，覆盖 date、keyword、clicks、impressions、ctr、position、country、device、page、source
- [x] 增加 CSV/JSON 文件解析、字段校验和错误提示
- [x] 增加关键词数据 tRPC 查询与导入接口，保留 source、importedAt、latestDate 元数据
- [x] 增加最近一次有效导入数据缓存，自动刷新时无新文件不丢失数据
- [x] 实现关键词趋势总览、点击/展示/CTR/平均排名图表和排名变化表
- [x] 实现日期、关键词、国家、设备、页面和来源筛选
- [x] 实现自动刷新间隔、手动刷新、最近刷新时间和数据状态提示
- [x] 添加 CSV/JSON 下载模板，避免用户导入字段不一致
- [x] 添加服务端解析、校验、缓存和聚合测试
- [x] 添加前端筛选、上传、刷新和空状态测试
- [x] 运行类型检查、测试、生产构建和桌面/移动端视觉验证
- [x] 保存版本并交付离线关键词趋势模块

- [x] 移除 CSV/JSON 下载模板中的示例关键词指标，仅保留字段表头，避免误导为真实数据

# Keyword Trend QA Corrections

- [x] 正确计算并展示关键词 previous vs latest position change
- [x] 在 Keyword Trends 页面补充 source 来源筛选控件并验证查询联动
- [x] 补充最近一次有效导入数据可在自动刷新/无新文件时继续读取的服务端测试
- [x] 新增 KeywordTrends 前端测试，覆盖空状态、筛选、导入和刷新状态
- [x] 修复后重新运行验证并保存新的交付检查点

# Keyword Trends UI QA

- [x] 为 KeywordTrends 页面补充真实前端测试：空状态渲染、source/keyword 筛选、文件导入触发、手动刷新和自动刷新状态
- [x] 在 UI QA 完成后重新保存 webdev checkpoint，并以新版本作为最终交付

# Keyword Trends Auto-refresh QA

- [x] 在真实组件测试中验证 refreshInterval 默认值与切换后的查询参数/状态文案
- [x] 完成自动刷新测试后保存包含全部最新改动的新 checkpoint
