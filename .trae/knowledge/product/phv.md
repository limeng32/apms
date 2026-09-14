---
id: product.phv
title: 青训生长发育与选材监控（PHV）
capability: phv
scope: current
phase: phase-1
status: committed
authority: 100
conflict_group: null
sources:
- document: 用户需求
  sections:
  - 青训生长发育与选材监控（PHV）
tags:
- PHV
- Mirwald
- Khamis-Roche
- 成年身高
- 生长发育
relations:
- domain.phv
- algorithm.mirwald
- algorithm.khamis-roche
---

# 青训生长发育与选材监控（PHV）

## 当前实现

系统录入青少年运动员的基础测量数据，并使用版本化公式计算生长发育相关结果。

核心输入包括：

- 年龄
- 站立身高
- 坐高
- 体重
- 父亲身高
- 母亲身高

核心输出包括：

- 成熟度偏移（Maturity Offset）
- 预计PHV年龄
- 预测成年身高
- 连续测量形成的成长趋势

## 公式与版本

PHV成熟度估算可采用 Mirwald 等成熟度方法；预测成年身高可采用 Khamis-Roche 等无创方法。

系统必须保留：

- 公式/算法版本
- 适用性别
- 输入字段
- 测量日期
- 必要的系数版本或参数版本

## 业务边界

计算结果用于：

- 成长跟踪
- 训练分组参考
- 选材辅助参考

计算结果**不作为医学诊断，也不作为单独选材结论**。

## 当前边界

以下能力属于扩展方向：

- Bio-banding 自动分组建议。
- 骨龄 TW3 / 中华05 录入与交叉验证。
- 公开文献常模 + 机构本地常模的自动更新。
- PHV阶段自动进入伤病风险权重。
- 家长端成长报告。

算法详情参见 `algorithm/mirwald.md` 与 `algorithm/khamis-roche.md`。
