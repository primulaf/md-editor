# v1.6.0 Mermaid 可选组件分发 Spec

日期：2026-07-27

## 目标

- 后续只维护一份扩展源码，不再按是否包含 Mermaid 分两条开发线。
- 由同一提交生成 Full、Lite 和 Dependency 三种发行产物。
- Full 自动渲染 Mermaid，Lite 保留源码且不加载运行库。
- Lite 可以通过覆盖安装 Dependency 包升级为 Full 能力，无需修改源码或设置。

## 能力模型

扩展根目录始终包含 `mermaid-capability.json`：

- `available: true`：继续校验 `lib/mermaid/version.json`，通过后才加载运行库。
- `available: false`：直接进入源码模式，不访问 Mermaid 运行文件。

能力标记和依赖清单必须同时匹配：

- 组件名称 `mermaid`
- 版本 `11.16.0`
- 渲染接口版本 `1`
- ESM 入口及分块目录
- 至少 100 个运行分块

缺失、版本不兼容或结构损坏均不得阻断 Markdown 渲染。

## 用户体验

- Mermaid 围栏初始以源码形式进入 DOM。
- Full 校验通过后切换为加载状态，并按现有延迟策略渲染 SVG。
- Lite 保持源码，仅在第一个 Mermaid 块显示紧凑的组件状态和“安装说明”入口。
- 安装说明在本地对话框中展示下载位置、目标路径、重新加载步骤和安全提醒。
- 补装依赖后重新加载扩展即可自动渲染，不增加用户开关。

## 发行产物

`npm run package` 必须生成：

1. `md-editor-full-1.6.0.zip`
2. `md-editor-lite-1.6.0.zip`
3. `md-editor-mermaid-11.16.0.zip`
4. `SHA256SUMS.txt`

Full 和 Lite 的应用代码必须相同，仅能力标记和 `lib/mermaid/` 是否存在不同。Dependency 包只允许包含启用后的能力标记和 `lib/mermaid/`。

## HTML 导出

- Full 中成功渲染的图表继续导出内联 SVG。
- Lite、组件不兼容或组件损坏时导出 Mermaid 源码。
- 安装提示和空画布不得进入导出的 HTML。

## 性能

- 普通 Markdown 不导入能力探测模块和 Mermaid 运行库。
- Lite 遇到 Mermaid 时只读取能力标记，不请求依赖清单或 ESM 文件。
- Full 仍按需加载 Mermaid，并沿用串行渲染、修订号和 LRU 缓存。

## 安全

- 不允许扩展自动下载或执行远程依赖。
- 安装说明只引导用户使用项目 Release 或公司内网提供的依赖包。
- 每次打包必须输出 SHA-256，并校验发行包不包含开发目录、测试文件或嵌套 ZIP。

## 验收标准

- Full 能自动渲染回归夹具中的 Mermaid 图表。
- Lite 显示源码，无控制台异常、无永久加载状态，ZIP 中不含 `lib/mermaid/`。
- Dependency 覆盖到 Lite 后，重新加载即可自动渲染。
- 错误版本和损坏清单稳定回退源码。
- 三个 ZIP 的目录范围、能力标记和 SHA-256 自动校验通过。
- `npm test`、`npm run package` 和浏览器桌面/窄屏检查通过。
