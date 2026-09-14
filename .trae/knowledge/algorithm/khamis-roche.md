---
id: algorithm.khamis-roche
title: Khamis-Roche预测成年身高
capability: phv
scope: algorithm
phase: cross-phase
status: needs-validation
authority: 70
conflict_group: null
sources:
- document: 用户需求
  sections:
  - 青训生长发育与选材监控（PHV）
  - 预测成年身高（Khamis-Roche 法）
tags:
- Khamis-Roche
- 成年身高
- PHV
- 算法
relations:
- product.phv
- domain.phv
---

# Khamis-Roche预测成年身高

## 项目用途

项目资料将 Khamis-Roche 作为无创成年身高预测方法之一。输入涉及：

- 年龄
- 性别
- 当前身高
- 体重
- 父亲身高
- 母亲身高

用户需求还描述了“坐高校正”的改良版本思路。

## 当前知识状态

**用户需求没有给出可直接落地的完整系数表或明确的实现公式版本。**

因此本知识卡不自行补充外部公式，也不把某个网上版本默认为项目标准。

## 实施要求

正式实现前需要业务方/专家确认：

1. 采用哪个 Khamis-Roche 公式版本。
2. 是否采用用户需求中所述的坐高校正版本。
3. 系数表及适用年龄、性别、人群范围。
4. 单位规范。
5. 是否输出误差区间，以及误差区间的来源。

确认后应将系数表与公式固化成版本化算法，并保留完整来源。
