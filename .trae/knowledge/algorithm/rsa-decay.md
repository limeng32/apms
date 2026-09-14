---
id: algorithm.rsa-decay
title: RSA冲刺衰减率计算
capability: football_test
scope: algorithm
phase: cross-phase
status: reference
authority: 80
conflict_group: null
sources:
- document: 用户需求
  sections:
  - 足球专项体能与敏捷测试模型库
  - 多次冲刺能力测试 RSA
tags:
- RSA
- 衰减率
- Sdec
- 算法
relations:
- domain.rsa
---

# RSA冲刺衰减率计算

## 输入

- 每次冲刺时间 `t_i`
- 冲刺次数 `n`

## 派生值

```text
总时间 = Σ t_i
最佳成绩 = min(t_i)
平均成绩 = Σ t_i / n
```

## 衰减率

用户需求给出的公式为：

```text
Sdec =
(总时间 - 最佳成绩 × 次数)
/ (最佳成绩 × 次数)
× 100%
```

## 解释

文档将 Sdec 作为反映疲劳耐受与无氧恢复能力的指标，评价方向为“越小越好”。

## 实现要求

- 保存所有单趟原始时间。
- 保存测试方案版本（距离、次数、间歇时间）。
- 保存算法版本。
- 不允许只保存最终Sdec而丢失原始成绩。
