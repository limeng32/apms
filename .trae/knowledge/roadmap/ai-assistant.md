---
id: roadmap.ai-assistant
title: AI辅助分析与智能问答
capability: ai
scope: roadmap
phase: phase-2-or-later
status: planned
authority: 50
conflict_group: null
sources:
- document: 用户需求
  sections:
  - AI 辅助分析与决策支持
tags:
- AI
- 智能问答
- 选材
- 训练建议
- 异常检测
relations:
- product.athlete-profile
- product.report
---

# AI辅助分析与智能问答

## 路线图定位

AI能力属于用户需求中的扩展范围，不属于当前一期交付边界。

## 规划能力

用户需求提出四类AI辅助能力：

1. 智能选材建议：结合发育预测、体能常模、技术评分形成潜力画像。
2. 训练建议：根据体测短板从建议库中匹配训练建议，由体能师审核后使用。
3. 异常检测：发现录入异常、负荷突增、成绩异常波动。
4. 智能问答：把自然语言问题转换为结构化查询并返回结果。

## AI边界

文档明确强调：

- AI输出仅用于辅助决策。
- 医疗诊断、用药、复出许可由队医负责。
- 选材结果不能成为淘汰运动员的唯一依据。
- AI建议应具备可解释依据。
- 私有化部署场景下，机构数据不应被任意外发。

## 推荐知识库接入方式

本知识库可作为智能问答的“产品/领域知识”来源；具体运动员实时数据应通过业务数据库或受控工具查询，不应把运动员实时业务数据长期复制进静态知识库。
