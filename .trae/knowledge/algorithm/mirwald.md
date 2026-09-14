---
id: algorithm.mirwald
title: Mirwald成熟度偏移计算
capability: phv
scope: algorithm
phase: cross-phase
status: reference
authority: 75
conflict_group: null
sources:
- document: 用户需求
  sections:
  - 青训生长发育与选材监控（PHV）
  - PHV 最大身高发育速度发生期
tags:
- Mirwald
- Maturity Offset
- PHV
- 算法
relations:
- product.phv
- domain.phv
---

# Mirwald成熟度偏移计算

> 本卡严格记录 用户需求中给出的公式，不替代原始论文或医学/运动科学专业审核。正式生产实现前应由业务专家确认公式版本及适用人群。

## 输入

- 年龄（文档要求精确到0.1岁）
- 站立身高
- 坐高
- 体重
- 腿长 = 站立身高 - 坐高
- 性别

## 男性公式

```text
成熟度偏移 =
-9.236
+ 0.0002708 × (腿长 × 坐高)
- 0.001663 × (年龄 × 腿长)
+ 0.007216 × (年龄 × 坐高)
+ 0.02292 × (体重 / 身高 × 100)
```

## 女性公式

```text
成熟度偏移 =
-9.376
+ 0.0001882 × (腿长 × 坐高)
+ 0.0022 × (年龄 × 腿长)
+ 0.005841 × (年龄 × 坐高)
+ 0.002658 × (年龄 × 体重)
- 0.07693 × (体重 / 身高 × 100)
```

## 结果解释

- 偏移值为负：预计尚未到达PHV。
- 偏移值为正：表示已越过PHV。
- 文档给出的预测PHV年龄计算方式：当前年龄 - 成熟度偏移值。

## 产品实现要求

必须记录：

- 算法ID
- 算法版本
- 性别
- 输入值
- 测量日期
- 输出值
- 计算时间

不要只保存最终结果而丢失算法版本和原始输入。
