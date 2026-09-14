---
id: domain.rtp
title: RTP与红黄绿参训状态概念
capability: rtp
scope: domain
phase: cross-phase
status: reference
authority: 80
conflict_group: rtp-decision-mode
sources:
- document: 用户需求
  sections:
  - 动态健康状态预警（RTP）
tags:
- RTP
- Return to Play
- 红黄绿
- 参训状态
relations:
- product.rtp
- roadmap.acwr
---

# RTP与红黄绿参训状态概念

## 在本项目中的含义

RTP用于表达运动员当前是否适合参与训练，以及参与训练时是否需要限制。

当前项目采用三色状态：

- 绿：正常全量训练。
- 黄：限制参训，需要控制训练量或训练科目。
- 红：不建议训练或进入停训/康复处理。

## 当前产品解释

当前版本将RTP实现为**专业人员负责的状态管理机制**，由授权康复师人工确认与修改，系统负责即时展示、权限控制和变更留痕。

## 路线图解释

扩展需求将RTP进一步定义为风险预警与康复流程的一部分，提出：

- 自动汇聚体测异常、伤病史、训练负荷、主观疲劳、医疗医嘱等因子。
- 规则引擎与多因子风险评分。
- 系统自动初判，专业人员可人工升降级。
- 红色状态触发熔断SOP及回归训练流程。

## 知识使用规则

当问题是“当前系统如何判定RTP”时，以 `product.rtp` 为准：**人工确认**。

当问题是“未来RTP可以如何演进”时，可以引用 用户需求扩展部分的自动预警方案。
