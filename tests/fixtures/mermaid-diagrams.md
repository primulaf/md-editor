# Mermaid 类型回归夹具

## Mindmap

```mermaid
mindmap
  root((产品))
    阅读
    编辑
```

## Flowchart

```mermaid
flowchart LR
  A[开始] --> B{判断}
  B --> C[结束]
```

## Sequence

```mermaid
sequenceDiagram
  A->>B: 请求
  B-->>A: 响应
```

## Class

```mermaid
classDiagram
  class Document {
    +String name
    +render()
  }
```

## State

```mermaid
stateDiagram-v2
  [*] --> Ready
  Ready --> Editing
  Editing --> [*]
```

## ER

```mermaid
erDiagram
  DOCUMENT ||--o{ SECTION : contains
  SECTION {
    string title
  }
```

## Gantt

```mermaid
gantt
  title 发布计划
  dateFormat YYYY-MM-DD
  section 开发
  实现功能 :a1, 2026-07-23, 2d
  回归测试 :after a1, 1d
```

## Pie

```mermaid
pie title 内容占比
  "正文" : 70
  "图表" : 30
```

## Journey

```mermaid
journey
  title 阅读流程
  section 打开
    选择文件: 5: 用户
    查看预览: 5: 用户
```

## Git Graph

```mermaid
gitGraph
  commit
  branch feature
  checkout feature
  commit
  checkout main
  merge feature
```

## Timeline

```mermaid
timeline
  title 版本演进
  1.5.0 : 保存重构
  1.6.0 : Mermaid
```

## Quadrant

```mermaid
quadrantChart
  x-axis 低价值 --> 高价值
  y-axis 低成本 --> 高成本
  quadrant-1 优先评估
  A: [0.7, 0.3]
```

## XY Chart

```mermaid
xychart-beta
  title "趋势"
  x-axis [1, 2, 3]
  y-axis "数量" 0 --> 10
  line [2, 5, 8]
```

## Sankey

```mermaid
sankey-beta
  Markdown,Parser,10
  Parser,SVG,8
  Parser,Error,2
```

## Block

```mermaid
block-beta
  columns 3
  A["开始"] B{"判断"} C["结束"]
  A --> B
  B --> C
```

## Architecture

```mermaid
architecture-beta
  group api(cloud)[API]
  service server(server)[Server] in api
  service db(database)[Database] in api
  server:R -- L:db
```

## 错误回退

```mermaid
notARealDiagram
  A --> B
```
