---
id: roadmap.realtime-device
title: 实时智能硬件与多设备生态
capability: device
scope: roadmap
phase: phase-3
status: planned
authority: 50
conflict_group: timing-gate-integration
sources:
- document: 用户需求
  sections:
  - 足球专项体能与敏捷测试模型库
  - 多设备组合测试与智能硬件生态
tags:
- 智能硬件
- 计时门
- 测力台
- GPS
- BLE
- SDK
- OTA
relations:
- integration.vald-smartspeed
- domain.rsa
- domain.yoyo
---

# 实时智能硬件与多设备生态

## 路线图定位

扩展需求将系统扩展为较完整的智能硬件生态，规划对接：

- 多通道光电计时门
- 测力台
- GPS/GNSS运动背心
- 心率设备
- 反应灯
- 体成分仪
- 视频分析设备
- 第三方医疗设备

并提出设备在线状态、校准、固件版本、OTA升级等设备生命周期管理能力。

## 与当前项目的冲突/差异

当前项目明确把硬件能力限定为：

- 手工录入
- CSV/标准结果文件导入
- 经联调验证的API/适配器
- 多设备结果级关联计算

当前项目**不默认承诺原始信号实时同步，也不要求统一采集时钟**。

因此扩展需求中的：

- 蓝牙/Wi-Fi原始事件实时回传
- 测力台原始力值曲线级接入
- 自动工位轮转
- 设备心跳
- 固件OTA

应视为路线图能力，而不是当前产品事实。

## 实施原则

对每种设备采用独立 Integration Card，记录：

- 厂商/型号
- 官方接口类型
- 鉴权方式
- 数据粒度
- 是否支持增量同步
- 是否支持实时事件
- 是否需要本地SDK
- 联调状态
- 当前项目承诺级别

SmartSpeed示例参见 `integration/vald-smartspeed.md`。
