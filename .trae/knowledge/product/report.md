---
id: product.report
title: 多维报告与趋势分析
capability: report
scope: current
phase: phase-1
status: committed
authority: 100
conflict_group: null
sources:
- document: 用户需求
  sections:
  - 多维报告生成
  - 多维报告生成与数据可视化
tags:
- 报告
- PDF
- 趋势
- 个人报告
- 团队报告
relations:
- product.athlete-profile
- product.test-task
---

# 多维报告与趋势分析

## 当前报告类型

当单项或组合测试结果齐备后，系统按既定模板生成：

- 个人综合报告
- 团队综合报告

## 报告内容

报告可集中呈现：

- 核心指标当前值
- 参考范围
- 状态判定
- RTP参训状态
- 组合指数（如有）
- 专业人员记录
- 历次测试结果与趋势

## PDF导出

报告支持导出 PDF。报告记录应保留生成时间与模板/参考口径版本，以便后续追溯。

## 趋势分析

支持对单一指标或复合算法得分进行近N次周期趋势折线分析。

## 自动生成的含义

“自动生成”是指在结果齐备后，系统按照既定模板组装内容并生成报告；**不等于系统自动生成训练处方或医学建议**。

## 当前边界

用户需求扩展部分中的四类报告、二维码分享、家长分发、查阅留痕、复杂常模组件、批量ZIP导出等属于扩展能力，不自动纳入当前交付范围。
