# Mermaid 主流图表示例

这份文档用于测试 md. v1.6.0 的 Mermaid 离线渲染能力。完整版应将以下代码块渲染为图表；精简版未安装 Mermaid 组件时应显示源码。

## 1. 流程图

适合表示业务流程、判断分支和处理步骤。

```mermaid
flowchart LR
  Start([打开 Markdown]) --> Check{包含 Mermaid?}
  Check -- 否 --> Markdown[渲染普通 Markdown]
  Check -- 是 --> Validate{组件可用?}
  Validate -- 否 --> Source[显示 Mermaid 源码]
  Validate -- 是 --> Diagram[渲染 SVG 图表]
  Markdown --> Done([完成])
  Source --> Done
  Diagram --> Done
```

## 2. 时序图

适合表示多个参与者之间按时间顺序发生的交互。

```mermaid
sequenceDiagram
  autonumber
  actor User as 用户
  participant App as md. 扩展
  participant Parser as Markdown 解析器
  participant Mermaid as Mermaid 引擎

  User->>App: 打开 Markdown 文件
  App->>Parser: 解析文档内容
  Parser-->>App: 返回预览结构
  App->>Mermaid: 提交图表源码
  Mermaid-->>App: 返回 SVG
  App-->>User: 显示完整预览
```

## 3. 类图

适合描述系统中的类、属性、方法以及类之间的关系。

```mermaid
classDiagram
  class MarkdownDocument {
    +String name
    +String content
    +render()
    +save()
  }

  class MermaidDiagram {
    +String source
    +String type
    +validate()
    +renderSvg()
  }

  class HtmlExporter {
    +exportDocument()
    +inlineSvg()
  }

  MarkdownDocument "1" *-- "0..*" MermaidDiagram : 包含
  MarkdownDocument --> HtmlExporter : 导出
  HtmlExporter ..> MermaidDiagram : 内联 SVG
```

## 4. 状态图

适合表示一个对象在不同状态之间的转换。

```mermaid
stateDiagram-v2
  [*] --> Reading
  state "阅读模式" as Reading
  state "编辑模式" as Editing
  state "存在未保存更改" as Dirty
  state "正在保存" as Saving

  Reading --> Editing : 编辑文档
  Editing --> Dirty : 修改内容
  Dirty --> Saving : 保存
  Saving --> Editing : 保存成功
  Editing --> Reading : 完成编辑
  Reading --> [*] : 关闭文档
```

## 5. ER 实体关系图

适合表示数据库实体、字段以及实体之间的关系。

```mermaid
erDiagram
  DOCUMENT ||--o{ SECTION : contains
  SECTION ||--o{ DIAGRAM : includes
  DOCUMENT {
    string id PK
    string filename
    datetime updatedAt
  }
  SECTION {
    string id PK
    string documentId FK
    string heading
  }
  DIAGRAM {
    string id PK
    string sectionId FK
    string diagramType
    string source
  }
```

## 6. 甘特图

适合表示项目计划、任务持续时间和先后依赖。

```mermaid
gantt
  title v1.6.0 发布计划
  dateFormat YYYY-MM-DD
  axisFormat %m-%d

  section 开发
  能力探测与源码回退 :done, develop, 2026-07-23, 3d
  多产物打包           :done, package, after develop, 2d

  section 验证
  自动测试             :done, test, after package, 1d
  浏览器验收           :done, browser, after test, 1d
  发布准备             :active, release, after browser, 2d
```

## 7. 饼图

适合表示各部分在整体中的占比。

```mermaid
pie showData
  title 示例文档内容占比
  "普通 Markdown" : 55
  "Mermaid 图表" : 30
  "代码与说明" : 15
```

## 8. 思维导图

适合表示主题拆解、知识结构和层级关系。

```mermaid
mindmap
  root((md.))
    阅读
      Markdown 预览
      可折叠目录
      五档字号
    编辑
      源文件保存
      另存为
      图片粘贴
    图表
      完整包自动渲染
      精简包显示源码
      可选依赖包
    导出
      自包含 HTML
      内联 SVG
```

## 预期结果

- 完整包：以上 8 个 Mermaid 代码块均显示为 SVG 图表。
- 精简包：以上代码块显示源码，第一个代码块上方出现 Mermaid 组件安装入口。
- 安装依赖包后：重新加载扩展并刷新本文档，所有图表自动开始渲染。
