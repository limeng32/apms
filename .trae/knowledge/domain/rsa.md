---
id: domain.rsa
title: RSA多次冲刺能力测试
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
  - 多次冲刺能力测试 RSA
tags:
- RSA
- 多次冲刺
- 衰减率
- 计时门
relations:
- algorithm.rsa-decay
- roadmap.realtime-device
---

# RSA多次冲刺能力测试

## 项目定义

RSA（Repeated Sprint Ability）用于评估运动员反复高强度冲刺能力及冲刺表现随重复次数产生的衰减。

## 当前系统需要记录

当前项目要求测试模型能够记录并计算：

- 每趟冲刺成绩
- 最佳成绩
- 平均成绩
- 衰减率

模型还应记录测试规程、字段、单位、有效性规则和算法版本，以保证不同批次口径一致。

## 数据采集

当前允许：

- 手工录入
- CSV导入
- 经验证的计时门 API / 适配器

设备接口实施受设备商开放条件与联调结果约束。

## 扩展示例方案

用户需求中给出的扩展示例为 7×30m、次间间歇25秒，并说明可配置为其他变式。该示例属于产品设计参考，具体实施参数需要按项目确认的测试方案执行。

衰减率公式参见 `algorithm/rsa-decay.md`。
