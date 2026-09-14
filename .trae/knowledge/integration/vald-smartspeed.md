---
id: integration.vald-smartspeed
title: VALD SmartSpeed Timing Gate 对接
capability: device
scope: integration
phase: current-compatible
status: external-verified
authority: 85
conflict_group: timing-gate-integration
sources:
- type: vendor_official
  title: A guide to using the External SmartSpeed API
  url: https://support.vald.com/hc/en-au/articles/38093151187865-A-guide-to-using-the-External-SmartSpeed-API
  checked: 2026-09-14
- type: vendor_official
  title: How to integrate with VALD APIs
  url: https://support.vald.com/hc/en-au/articles/23415335574553-How-to-integrate-with-VALD-APIs
  checked: 2026-09-14
- type: project_reference
  document: 用户需求
  section: 足球专项体能与敏捷测试模型库 / 智能硬件对接
  note: 当前项目仅承诺标准结果文件或经验证 API/适配器接入
tags:
- VALD
- SmartSpeed
- Timing Gate
- API
- OAuth2
- 计时门
relations:
- domain.rsa
- domain.yoyo
- roadmap.realtime-device
---

# VALD SmartSpeed Timing Gate 对接

## 与当前项目边界的关系

当前项目允许计时门通过**标准结果文件或经验证的API/适配器**接入，接口实施以设备厂商开放条件与联调结果为准。

VALD 官方提供 External SmartSpeed API，因此可优先采用“官方结果API同步”方式，而不必自行实现底层蓝牙协议。

## 官方API能力

VALD 官方说明 External SmartSpeed API 用于访问 team / profile test data。

澳大利亚东部区域基地址：

```text
https://prd-aue-api-extsmartspeed.valdperformance.com/
```

常用接口：

```text
GET /v1/team/{teamId}/tests
GET /v1/team/{teamId}/tests/{testId}/detail
```

概要测试数据可包含总测试时间、最大速度等；详细测试数据可包含计时门之间的 split timings 等低层结果。

## 增量同步

列表接口支持 `modifiedFromUtc` 等查询条件，可用于按上次同步时间增量拉取测试结果。

推荐同步链路：

```text
SmartSpeed Timing Gates
  -> SmartSpeed/VALD系统
  -> VALD Hub / External SmartSpeed API
  -> APMS Spring Boot 适配器
  -> 测试结果 / 指标值
```

## API访问申请

VALD官方要求第三方开发方：

1. 获取客户的 VALD Hub Organization ID。
2. 发邮件至 `support@vald.com` 申请 External API 访问。
3. 如果是替客户开发，应 CC 客户方代表进行授权。
4. 签署 API License Agreement。
5. 审批后获得 `clientId` 与 `clientSecret`。

凭证必须安全保存，不应硬编码到代码仓库。

## 当前未确认能力

官方公开资料能够证明的是 External SmartSpeed **结果数据API**。

当前知识库没有证据证明 VALD 向普通第三方公开：

- SmartSpeed设备级BLE协议
- 光束中断实时事件SDK
- 第三方直接控制计时门的公开SDK

因此，不应把“APMS直接蓝牙控制SmartSpeed硬件”写成当前已具备能力。
