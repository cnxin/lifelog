# 全局表单控件视觉统一方案

**项目**: LifeLog React App  
**目标**: 将已确认的 LifeLog 风格应用到原始 select/date/time/number/boolean 选择类控件  
**范围**: EntrySheet、Places 筛选、ReminderSettings、Settings Demo  
**原则**: 保持功能不变，优先复用共享组件，不引入第三方 UI 库

---

## 执行清单

- [x] 1. 扫描原始控件分布并确定替换范围
- [x] 2. 抽取共享控件组件：SelectPicker / NumberInput / DateInput / TimePicker 复用
- [x] 3. 替换 EntrySheet 人物表单：收藏、生日年月日
- [x] 4. 替换 EntrySheet 地点表单：评分、收藏
- [x] 5. 替换 EntrySheet 回忆表单：日期、地点选择、快速记录人物/地点选择
- [x] 6. 替换 Places 页面筛选 select
- [x] 7. 替换 ReminderSettings 数字输入，保留已替换的 TimePicker
- [x] 8. 清理 Settings Demo 中的旧原生控件示例
- [x] 9. 运行 TypeScript 检查
- [x] 10. 汇报变更范围和预览路径

## 验收标准

- 不再出现浏览器默认 select 下拉视觉。
- date/time/number 选择类控件有统一宽高、圆角、focus 状态和触控尺寸。
- 所有替换保持原字段 name/value/onChange 语义不变。
- 新增/编辑人物、地点、回忆仍能保存。
- Places 筛选仍能正常工作。

## 进度追踪

- **总进度**: ✅ 10/10
