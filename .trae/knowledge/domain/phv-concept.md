---
id: domain.phv
title: PHV与生物成熟度监控概念
capability: phv
scope: domain
phase: cross-phase
status: reference
authority: 80
conflict_group: null
sources:
- document: 用户需求
  sections:
  - 青训生长发育与选材监控（PHV）
tags:
- PHV
- 生物成熟度
- Maturity Offset
- 青训
relations:
- product.phv
- algorithm.mirwald
- algorithm.khamis-roche
---

# PHV与生物成熟度监控概念

## PHV

PHV（Peak Height Velocity）在项目文档中用于描述青少年最大身高发育速度发生期。系统通过无创的人体测量数据，对运动员的成熟度状态和PHV时间窗口进行估算。

## 基础输入

项目资料涉及的基础测量包括：

- 年龄
- 站立身高
- 坐高
- 体重
- 父母身高

其中腿长可由“站立身高 - 坐高”获得，用于 Mirwald 成熟度偏移计算。

## 输出

系统可形成：

- 成熟度偏移
- 预计PHV年龄
- 成熟度阶段
- 预测成年身高
- 连续测量趋势

## 使用边界

PHV相关结果用于成长跟踪、训练分组和选材参考，不应被描述为医学诊断，也不应作为淘汰或选材的唯一依据。

## 路线图扩展

用户需求还提出 Bio-banding、骨龄录入、常模百分位、生长速度曲线和发育阶段风险权重等扩展设计。
