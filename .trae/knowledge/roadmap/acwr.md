---
id: roadmap.acwr
title: ACWR训练负荷监控与RTP自动预警
capability: workload
scope: roadmap
phase: phase-2
status: planned
authority: 50
conflict_group: rtp-decision-mode
sources:
- document: 用户需求
  sections:
  - 动态健康状态预警（RTP）
  - 训练负荷监控与周期化管理
tags:
- ACWR
- sRPE
- TRIMP
- 负荷监控
- RTP
relations:
- product.rtp
- domain.rtp
---

# ACWR训练负荷监控与RTP自动预警

## 路线图定位

本能力属于用户需求中的扩展范围，不属于当前一期交付边界。

## ACWR定义（按产品说明书）

- 急性负荷：最近7天训练负荷总量。
- 慢性负荷：最近28天平均周负荷。
- ACWR = 急性负荷 / 慢性负荷。

默认负荷口径可以使用 sRPE，并可扩展 TRIMP、GPS总距离、高强度跑距离等。

## 文档示例分区

- `< 0.8`：低负荷区
- `0.8–1.3`：甜区
- `1.3–1.5`：警戒区
- `> 1.5`：危险区

这些范围在用户需求中被描述为可配置、需按机构数据校准的产品规则。

## 与RTP的路线图联动

扩展需求规划将 ACWR 与以下因子共同进入预警：

- 近期体测异常
- 伤病史
- 主观疲劳
- 睡眠/恢复
- PHV阶段
- 医疗医嘱

系统可进行规则引擎与多因子加权评分，再给出RTP初判。

## 当前使用限制

回答“当前项目是否自动按ACWR改变红黄绿状态”时，答案必须是：**否，当前项目由康复师人工确认。**
