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
- [ ] 补充销售汇总、CSO 缓存命中/过期与异常 warning 服务端测试
- [x] 添加前端筛选交互测试，覆盖快捷日期、月份年份、自定义范围和刷新
- [x] 记录桌面端与移动端验收结论

- [x] 为 Outlet Comparison、部门收入图和 CSO 主面板补充明确的 empty/no-data UI
- [x] 扩展前端测试以覆盖快捷按钮、月份/年份、自定义日期和 Refresh 行为
- [x] 将桌面端与移动端验收检查项和结论写入 qa-acceptance.md
