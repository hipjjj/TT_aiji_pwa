# 拳头份量参考

检索日期：2026-10-15。通过 `Review public hand portion references` 手动工作流抓取公开网页，不读取用户数据。

- [Precision Nutrition: Hand portion FAQ](https://www.precisionnutrition.com/hand-portion-faq)：网页表格明确列出 `1 fist (veggies) ~1 cup non-starchy vegetables`，并把蛋白质的掌心与碳水的捧手分开。该来源不是“所有食物一拳等于固定克数”的依据。
- [Diabetes UK: Portion sizes](https://www.diabetes.org.uk/living-with-diabetes/eating/portion-sizes)：网页举例拳头大小的带皮烤土豆、红薯约220g，说明不同食物/手势不能共用固定克重。应用未把此220g套用到水煮土豆。
- [USDA SR28 数据来源](food-data.md)：沿用项目已固定提交及SHA256校验的原始SQLite `weight` 表，从同一食品编号的 `amount, description, gm_weight` 提取杯重；半杯记录按比例换算一杯。生成文件 `src/nutrition/hand-portions.json` 保存原始数值、切法和编号，可运行原食物库生成脚本复现。

实现约定：将1拳≈1杯作为视觉体积的粗估起点，推广到有同种食品杯重的部分固体食物是**本应用的估算约定**，不是来源机构针对所有食物的推荐。不是个人拳头测量或克重标准。每一项生成克数和完整假设，用户可修改；熟菠菜180g/杯、生菠菜30g/杯，严格使用对应状态。油不自动计入水煮食物。没有杯重的肉类、菜品、未知食物不按统一密度自动填值；可改填克数、选择食物或问AI。

已支持35项常见食品及其食物库别名，支持一拳、两拳、半拳、两个拳头等前后缀。原句“米饭400g+炒牛肉两拳+萝卜叶半拳”仍只能本地确定米饭：炒菜的名称、油量和萝卜叶的营养条目仍需另行核对，增加单位不能伪造缺失的菜品数据。

CDC页面抓取返回403、BHF旧地址404；二者未作为实现依据。
