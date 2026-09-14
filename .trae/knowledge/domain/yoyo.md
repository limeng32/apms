---
id: domain.yoyo
title: Yo-Yo间歇恢复测试
capability: football_test
scope: domain
phase: cross-phase
status: reference
authority: 80
conflict_group: null
sources:
- document: 用户需求
  sections:
  - 足球专项体能与敏捷测试模型库
  - Yo-Yo 间歇恢复测试
tags:
- Yo-Yo
- 间歇恢复
- 耐力
- VO2max
relations:
- product.test-task
---

# Yo-Yo间歇恢复测试

## 项目定位

Yo-Yo间歇恢复测试是当前足球专项测试模型库中的核心测试之一，用于评估足球运动员间歇性高强度运动能力。

## 当前系统要求

系统应能保存：

- 测试版本/方案
- 测试批次
- 原始测试结果
- 终止等级或阶段
- 总距离
- 派生指标（按项目确认的公式计算）

## 扩展方案描述

用户需求中描述了 YYIR Level 1 / Level 2 的标准化测试流程，并给出了基于总距离推算 VO2max 的示例公式：

- IR1：VO2max = 距离 × 0.0084 + 36.4
- IR2：VO2max = 距离 × 0.0136 + 45.3

这些公式来自用户需求中的扩展设计内容。实现时应把公式作为**版本化算法**保存，而不是写死为不可追溯的固定逻辑。

## 数据来源

当前项目允许手工、CSV或经验证设备接口获取结果，不要求自行实现专用硬件底层协议。
