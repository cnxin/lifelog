# 日期弹出菜单 UI 统一方案

**目标**: 将 `DateInput` 的原生浏览器日期弹窗改成与 `SelectPicker` / `TimePicker` 一致的 LifeLog 风格浮层。  
**范围**: `DateInput` 组件、日期浮层 CSS、使用该组件的生日/纪念日/回忆日期控件。  
**原则**: 保持现有 `name` / `value` / `defaultValue` / `onChange` 语义不变，不影响表单提交。

## 执行清单

- [x] 1. 重写 DateInput 为自定义按钮 + portal 日期菜单
- [x] 2. 日期菜单使用年/月/日三列有限列表，选择日期后输出 `YYYY-MM-DD`
- [x] 3. 添加 DateInput 浮层样式，和 SelectPicker / TimePicker 统一
- [x] 4. 运行构建检查
- [x] 5. 汇报预览路径

## 验收标准

- 点击生日日期控件不再出现浏览器默认日期弹窗。
- 日期弹窗层级不被卡片遮挡。
- 日期弹窗视觉与其他下拉菜单一致。
- 人物生日、纪念日、回忆日期保存字段保持不变。
