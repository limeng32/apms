<template>
  <div class="app-container rk-detail-page" v-loading="loading">
    <!-- 返回面包屑 -->
    <div class="rk-crumb">
      <button class="rk-crumb-link" @click="goBack"><el-icon><ArrowLeft/></el-icon>花名册</button>
      <span>/</span>
      <span class="rk-crumb-current">{{ athlete.name || '运动员档案' }}</span>
    </div>

    <!-- ===== ProfileHeader 通栏卡 ===== -->
    <div class="rk-profile">
      <span class="rk-profile-avatar" :style="{ background: avatarBg }">{{ nameChar }}</span>
      <div class="rk-profile-main">
        <div class="rk-profile-name-row">
          <span class="rk-profile-name">{{ athlete.name || '-' }}</span>
          <span class="rk-status-badge" :class="'tone-' + rtpTone">
            <span v-if="rtpTone === 'red'" class="rk-status-dot-wrap">
              <span class="rk-status-ping"></span><span class="rk-status-dot"></span>
            </span>
            <span v-else class="rk-status-dot"></span>
            {{ rtpStatus ? rtpLabel(rtpStatus.status) : '未评估' }}
          </span>
          <span class="rk-status-badge" :class="'tone-' + athleteStatusTone">{{ statusLabel(athlete.status) }}</span>
          <GenderBadge :gender="athlete.gender" :size="20"/>
          <span v-if="athlete.position" class="rk-soft-chip">{{ positionLabel(athlete.position) }}</span>
        </div>
        <div class="rk-profile-meta">
          <span>{{ athlete.teamName || '未分配队伍' }}</span>
          <span>编号 <span class="rk-mono">#{{ athlete.athleteId || athleteId }}</span></span>
          <span v-if="athlete.jerseyNo">球衣 {{ athlete.jerseyNo }}</span>
          <span v-if="athlete.age != null">{{ athlete.age }} 岁</span>
          <span v-if="athlete.birthday">出生 {{ athlete.birthday }}</span>
          <span v-if="athlete.phone">电话 {{ athlete.phone }}</span>
          <span v-if="latestPhv" class="rk-profile-meta-sub">
            预测 PHV <span class="rk-mono">{{ Number(latestPhv.predictedPhvAge).toFixed(2) }}</span> 岁
            · 成熟度偏移 <span class="rk-mono" :class="offsetClass(latestPhv.maturityOffset)">{{ fmtOffset(latestPhv.maturityOffset) }}</span> 岁
            · {{ latestPhv.measureDate }} 评估
          </span>
        </div>
      </div>
      <div class="rk-profile-side">
        <div class="rk-mini-stats">
          <div class="rk-mini-stat">
            <span class="rk-mini-stat-label">身高</span>
            <span class="rk-mini-stat-value">{{ latestBody.height != null ? latestBody.height : '—' }}<span class="rk-mini-stat-unit">cm</span></span>
          </div>
          <div class="rk-mini-stat">
            <span class="rk-mini-stat-label">体重</span>
            <span class="rk-mini-stat-value">{{ latestBody.weight != null ? latestBody.weight : '—' }}<span class="rk-mini-stat-unit">kg</span></span>
          </div>
          <div class="rk-mini-stat">
            <span class="rk-mini-stat-label">体脂</span>
            <span class="rk-mini-stat-value">{{ latestBody.bodyFatRate != null ? latestBody.bodyFatRate : '—' }}<span class="rk-mini-stat-unit">%</span></span>
          </div>
          <div class="rk-mini-stat">
            <span class="rk-mini-stat-label">预测成年身高</span>
            <span class="rk-mini-stat-value">{{ athlete.predictedAdultHeight != null ? Number(athlete.predictedAdultHeight).toFixed(1) : '—' }}<span class="rk-mini-stat-unit">cm</span></span>
          </div>
        </div>
        <div class="rk-profile-actions">
          <button class="rk-btn" @click="goBack"><el-icon><ArrowLeft/></el-icon>返回列表</button>
          <button class="rk-btn rk-btn-primary" @click="openBodyMeasureDialog" v-hasPermi="['apms:athlete:edit']">
            <el-icon><Plus/></el-icon>新增测量
          </button>
        </div>
      </div>
    </div>

    <!-- RTP 黄/红预警横幅 -->
    <div v-if="rtpBanner" class="rk-banner" :class="'tone-' + rtpBanner.tone">
      <span class="rk-banner-title">{{ rtpBanner.label }}</span>
      <span v-if="rtpStatus.reason" class="rk-banner-item">原因：{{ rtpStatus.reason }}</span>
      <span v-if="rtpStatus.trainingLimit" class="rk-banner-item">训练限制：{{ rtpStatus.trainingLimit }}</span>
      <span v-if="rtpStatus.nextReviewDate" class="rk-banner-item">下次复核 <span class="rk-mono">{{ rtpStatus.nextReviewDate }}</span></span>
    </div>

    <!-- ===== Tab 栏 ===== -->
    <div class="rk-tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="rk-tab"
        :class="{ 'is-active': activeTab === t.key }"
        @click="activeTab = t.key"
      >{{ t.label }}</button>
    </div>

    <!-- ===== Tab 1: 小组归属 ===== -->
    <div v-show="activeTab === 'group'" class="rk-tab-panel">
      <div class="rk-toolbar">
        <button class="rk-btn rk-btn-primary rk-btn-sm" @click="showJoinDialog = true" v-hasPermi="['apms:athlete:edit']">
          <el-icon><Plus/></el-icon>加入新小组
        </button>
        <button v-if="currentGroup" class="rk-btn rk-btn-danger rk-btn-sm" @click="handleLeave" v-hasPermi="['apms:athlete:edit']">
          <el-icon><Minus/></el-icon>离开当前小组
        </button>
      </div>
      <div class="rk-card">
        <div class="rk-table-scroll">
          <table class="rk-table">
            <thead>
              <tr>
                <th>小组</th><th>类型</th><th>加入日期</th><th>离开日期</th><th>状态</th><th>操作人</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in groupHistory" :key="i" class="rk-row" :class="{ 'is-zebra': i % 2 === 1 }">
                <td class="ad-cell-strong">{{ row.deptName || '—' }}</td>
                <td><span class="dt-chip" :class="groupTypeCls(row.deptTypeName)">{{ row.deptTypeName || '—' }}</span></td>
                <td class="rk-mono">{{ row.joinDate || '—' }}</td>
                <td>
                  <span v-if="row.leaveDate" class="rk-mono">{{ row.leaveDate }}</span>
                  <span v-else class="rk-status-badge tone-green">当前在组</span>
                </td>
                <td>
                  <span class="rk-status-badge" :class="row.status === '0' ? 'tone-green' : 'tone-gray'">
                    {{ row.status === '0' ? '在组' : '已离组' }}
                  </span>
                </td>
                <td class="rk-text-3">{{ row.createBy || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="groupHistory.length === 0" class="rk-empty">
            <p class="rk-empty-title">暂无小组归属记录</p>
            <p class="rk-empty-desc">该运动员尚未加入任何训练或科研小组</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Tab 2: 体态测量 ===== -->
    <div v-show="activeTab === 'body'" class="rk-tab-panel">
      <div class="rk-toolbar">
        <button class="rk-btn rk-btn-primary rk-btn-sm" @click="openBodyMeasureDialog" v-hasPermi="['apms:athlete:edit']">
          <el-icon><Plus/></el-icon>新增测量
        </button>
        <button class="rk-btn rk-btn-sm" @click="showTrend = !showTrend">
          <el-icon><DataLine/></el-icon>{{ showTrend ? '隐藏趋势' : '查看体态趋势' }}
        </button>
      </div>

      <!-- 趋势图（echarts，指标可勾选） -->
      <div v-if="showTrend" class="rk-card">
        <div class="rk-card-head">
          <span class="rk-card-title">体态变化趋势</span>
          <span class="rk-card-sub">全部 {{ bodyMeasures.length }} 次测量，按日期升序</span>
        </div>
        <div class="rk-card-body">
          <BodyTrendChart :records="bodyMeasures"/>
        </div>
      </div>

      <!-- 完整列表 -->
      <div class="rk-card" :class="{ 'ad-card-gap': showTrend && bodyMeasures.length >= 2 }">
        <div class="rk-table-scroll">
          <table class="rk-table">
            <thead>
              <tr>
                <th>日期</th><th class="text-right">身高(cm)</th><th class="text-right">坐高(cm)</th><th class="text-right">体重(kg)</th>
                <th class="text-right">腿长(cm)</th><th class="text-right">体脂率(%)</th><th class="text-right">腰围(cm)</th>
                <th>来源</th><th class="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in bodyMeasures" :key="row.id" class="rk-row" :class="{ 'is-zebra': i % 2 === 1 }">
                <td class="rk-mono">{{ row.measureDate }}</td>
                <td class="text-right rk-mono">{{ num(row.height) }}</td>
                <td class="text-right rk-mono">{{ num(row.sitHeight) }}</td>
                <td class="text-right rk-mono">{{ num(row.weight) }}</td>
                <td class="text-right rk-mono">{{ fmtLeg(row) }}</td>
                <td class="text-right rk-mono">{{ num(row.bodyFatRate) }}</td>
                <td class="text-right rk-mono">{{ num(row.waist) }}</td>
                <td><span class="rk-soft-chip">{{ sourceLabel(row.dataSource) }}</span></td>
                <td class="text-center">
                  <button class="ad-icon-btn ad-icon-danger" title="删除" @click="handleDeleteMeasure(row)" v-hasPermi="['apms:athlete:remove']">
                    <el-icon><Delete/></el-icon>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="bodyMeasures.length === 0" class="rk-empty">
            <p class="rk-empty-title">暂无体态测量记录</p>
            <p class="rk-empty-desc">点击「新增测量」录入首次身高体重数据</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Tab 3: RTP 参训状态 ===== -->
    <div v-show="activeTab === 'rtp'" class="rk-tab-panel">
      <div class="rk-toolbar">
        <button class="rk-btn rk-btn-primary rk-btn-sm" @click="showRtpDialog = true" v-hasPermi="['apms:athlete:edit']">
          <el-icon><Edit/></el-icon>更新状态
        </button>
        <button v-if="rtpStatus" class="rk-btn rk-btn-sm" @click="handleClearRtp" v-hasPermi="['apms:athlete:edit']">
          <el-icon><RefreshLeft/></el-icon>清除为未评估
        </button>
      </div>

      <!-- 当前状态 -->
      <div v-if="rtpStatus" class="rk-rtp-panel" :class="'tone-' + rtpTone">
        <div class="rk-rtp-icon" :class="'tone-' + rtpTone"><el-icon><component :is="rtpIcon(rtpStatus.status)"/></el-icon></div>
        <div class="rk-rtp-info">
          <div class="rk-rtp-label">当前状态</div>
          <div class="rk-rtp-value">{{ rtpLabel(rtpStatus.status) }}</div>
          <div v-if="rtpStatus.reason" class="rk-rtp-meta">原因：{{ rtpStatus.reason }}</div>
          <div v-if="rtpStatus.trainingLimit" class="rk-rtp-meta">训练限制：{{ rtpStatus.trainingLimit }}</div>
          <div v-if="rtpStatus.nextReviewDate" class="rk-rtp-meta">下次复核：<span class="rk-mono">{{ rtpStatus.nextReviewDate }}</span></div>
          <div class="rk-rtp-foot">更新于 {{ rtpStatus.updatedTime }} · {{ rtpStatus.updatedBy }}</div>
        </div>
      </div>
      <div v-else class="rk-card">
        <div class="rk-empty">
          <p class="rk-empty-title">尚未进行 RTP 评估</p>
          <p class="rk-empty-desc">点击「更新状态」登记参训许可结论</p>
        </div>
      </div>

      <!-- 变更历史 -->
      <div v-if="rtpLogs.length > 0" class="rk-card ad-card-gap">
        <div class="rk-card-head">
          <span class="rk-card-title">变更历史</span>
          <span class="rk-card-sub">共 {{ rtpLogs.length }} 条</span>
        </div>
        <div class="rk-card-body flush">
          <div class="rk-table-scroll">
            <table class="rk-table">
              <thead>
                <tr><th>时间</th><th>变更</th><th>原因</th><th>训练限制</th><th>下次复核</th><th>操作人</th></tr>
              </thead>
              <tbody>
                <tr v-for="(log, i) in rtpLogs" :key="i" class="rk-row" :class="{ 'is-zebra': i % 2 === 1 }">
                  <td class="rk-mono">{{ log.operateTime }}</td>
                  <td>
                    <span class="rk-status-badge" :class="'tone-' + rtpToneOf(log.fromStatus)">{{ rtpLabel(log.fromStatus) }}</span>
                    <span class="ad-arrow">→</span>
                    <span class="rk-status-badge" :class="'tone-' + rtpToneOf(log.toStatus)">{{ rtpLabel(log.toStatus) }}</span>
                  </td>
                  <td class="rk-text-2">{{ log.reason || '—' }}</td>
                  <td class="rk-text-2">{{ log.trainingLimit || '—' }}</td>
                  <td class="rk-mono">{{ log.nextReviewDate || '—' }}</td>
                  <td class="rk-text-3">{{ log.operatorName || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Tab 4: PHV 生长发育 ===== -->
    <div v-show="activeTab === 'phv'" class="rk-tab-panel">
      <div class="rk-toolbar">
        <el-dropdown v-if="bodyMeasures.length > 0" @command="handlePhvDropdown" trigger="click" v-hasPermi="['apms:athlete:edit']">
          <button class="rk-btn rk-btn-primary rk-btn-sm">
            <el-icon><DataLine/></el-icon>计算 PHV<el-icon class="ad-caret"><ArrowDown/></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="m in bodyMeasures.slice(0, 10)" :key="m.id" :command="m">
                {{ m.measureDate }} · 身高{{ m.height }}/坐高{{ m.sitHeight }}/体重{{ m.weight }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <button class="rk-btn rk-btn-sm" @click="showPhvDialog = true" v-hasPermi="['apms:athlete:edit']">
          <el-icon><Edit/></el-icon>手动输入计算
        </button>
      </div>

      <!-- 最新 PHV 摘要 -->
      <div v-if="latestPhv" class="rk-card">
        <div class="rk-card-head">
          <span class="rk-card-title">最新 PHV 评估摘要</span>
          <span class="rk-card-sub">{{ latestPhv.measureDate }} · Mirwald v{{ latestPhv.mirwaldVersion || '2014.1' }}</span>
        </div>
        <div class="rk-card-body">
          <div class="rk-desc-grid">
            <div class="rk-desc-item"><div class="rk-desc-label">评估日期</div><div class="rk-desc-value">{{ latestPhv.measureDate }}</div></div>
            <div class="rk-desc-item"><div class="rk-desc-label">精确年龄</div><div class="rk-desc-value">{{ latestPhv.decimalAge != null ? Number(latestPhv.decimalAge).toFixed(2) + ' 岁' : '—' }}</div></div>
            <div class="rk-desc-item">
              <div class="rk-desc-label">成熟度偏移</div>
              <div class="rk-desc-value" :class="offsetClass(latestPhv.maturityOffset)">{{ fmtOffset(latestPhv.maturityOffset) }}</div>
            </div>
            <div class="rk-desc-item"><div class="rk-desc-label">预计 PHV 年龄</div><div class="rk-desc-value ad-violet">{{ latestPhv.predictedPhvAge != null ? Number(latestPhv.predictedPhvAge).toFixed(2) + ' 岁' : '—' }}</div></div>
            <div class="rk-desc-item"><div class="rk-desc-label">身高</div><div class="rk-desc-value">{{ latestPhv.height }} cm</div></div>
            <div class="rk-desc-item"><div class="rk-desc-label">坐高</div><div class="rk-desc-value">{{ latestPhv.sitHeight }} cm</div></div>
            <div class="rk-desc-item"><div class="rk-desc-label">腿长</div><div class="rk-desc-value">{{ latestPhv.legLength != null ? latestPhv.legLength : '—' }} cm</div></div>
            <div class="rk-desc-item"><div class="rk-desc-label">体重</div><div class="rk-desc-value">{{ latestPhv.weight }} kg</div></div>
          </div>
          <div class="rk-note">
            <el-icon><InfoFilled/></el-icon>
            <span>成熟度偏移 &lt; 0 表示尚未到达 PHV；&gt; 0 表示已越过 PHV。算法：Mirwald v{{ latestPhv.mirwaldVersion || '2014.1' }}</span>
          </div>
        </div>
      </div>

      <!-- PHV 历史 -->
      <div class="rk-card" :class="{ 'ad-card-gap': latestPhv }">
        <div class="rk-table-scroll">
          <table class="rk-table">
            <thead>
              <tr>
                <th>日期</th><th class="text-right">年龄</th><th class="text-right">身高(cm)</th><th class="text-right">坐高(cm)</th>
                <th class="text-right">体重(kg)</th><th class="text-right">腿长(cm)</th><th class="text-right">成熟度偏移</th>
                <th class="text-right">预计 PHV 年龄</th><th class="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in phvRecords" :key="row.id" class="rk-row" :class="{ 'is-zebra': i % 2 === 1 }">
                <td class="rk-mono">{{ row.measureDate }}</td>
                <td class="text-right rk-mono">{{ Number(row.decimalAge).toFixed(2) }}</td>
                <td class="text-right rk-mono">{{ row.height }}</td>
                <td class="text-right rk-mono">{{ row.sitHeight }}</td>
                <td class="text-right rk-mono">{{ row.weight }}</td>
                <td class="text-right rk-mono">{{ row.legLength != null ? Number(row.legLength).toFixed(1) : '—' }}</td>
                <td class="text-right rk-mono" :class="offsetClass(row.maturityOffset)">{{ fmtOffset(row.maturityOffset) }}</td>
                <td class="text-right rk-mono ad-violet">{{ Number(row.predictedPhvAge).toFixed(2) }}</td>
                <td class="text-center">
                  <button class="ad-icon-btn ad-icon-danger" title="删除" @click="handleDeletePhv(row)" v-hasPermi="['apms:athlete:remove']">
                    <el-icon><Delete/></el-icon>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="phvRecords.length === 0" class="rk-empty">
            <p class="rk-empty-title">暂无 PHV 评估记录</p>
            <p class="rk-empty-desc">可基于历史测量直接计算，或手动输入参数计算</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 加入小组对话框 ========== -->
    <el-dialog title="加入小组" v-model="showJoinDialog" width="420px">
      <el-form :model="joinForm" label-width="80px">
        <el-form-item label="目标小组">
          <el-select v-model="joinForm.deptId" placeholder="请选择" style="width: 100%">
            <el-option v-for="d in groupDeptOptions" :key="d.deptId" :label="d.deptName" :value="d.deptId"/>
          </el-select>
        </el-form-item>
        <el-form-item label="加入日期">
          <el-date-picker v-model="joinForm.joinDate" type="date" value-format="YYYY-MM-DD" placeholder="默认今天" style="width: 100%"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showJoinDialog = false">取 消</el-button>
        <el-button type="primary" @click="submitJoin">确 定</el-button>
      </template>
    </el-dialog>

    <!-- ========== 新增体态测量对话框 ========== -->
    <el-dialog title="新增体态测量" v-model="showBodyDialog" width="520px">
      <el-form :model="bodyForm" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="测量日期"><el-date-picker v-model="bodyForm.measureDate" type="date" value-format="YYYY-MM-DD" style="width: 100%"/></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="身高(cm)"><el-input-number v-model="bodyForm.height" :precision="1" :step="0.1" :min="0" style="width: 100%"/></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="坐高(cm)"><el-input-number v-model="bodyForm.sitHeight" :precision="1" :step="0.1" :min="0" style="width: 100%"/></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="体重(kg)"><el-input-number v-model="bodyForm.weight" :precision="1" :step="0.1" :min="0" style="width: 100%"/></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="体脂率(%)"><el-input-number v-model="bodyForm.bodyFatRate" :precision="1" :step="0.1" :min="0" style="width: 100%"/></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="腰围(cm)"><el-input-number v-model="bodyForm.waist" :precision="1" :step="0.1" :min="0" style="width: 100%"/></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showBodyDialog = false">取 消</el-button>
        <el-button type="primary" @click="submitBody">保 存</el-button>
      </template>
    </el-dialog>

    <!-- ========== RTP 状态对话框 ========== -->
    <el-dialog title="更新 RTP 参训状态" v-model="showRtpDialog" width="500px">
      <el-form :model="rtpForm" label-width="100px">
        <el-form-item label="状态">
          <el-radio-group v-model="rtpForm.status">
            <el-radio value="g"><el-tag type="success">正常参训</el-tag></el-radio>
            <el-radio value="y"><el-tag type="warning">限制参训</el-tag></el-radio>
            <el-radio value="r"><el-tag type="danger">不建议参训</el-tag></el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标记原因"><el-input v-model="rtpForm.reason" type="textarea" :rows="2" maxlength="500" show-word-limit/></el-form-item>
        <el-form-item label="训练限制"><el-input v-model="rtpForm.trainingLimit" type="textarea" :rows="2" maxlength="500" show-word-limit/></el-form-item>
        <el-form-item label="下次复核">
          <el-date-picker v-model="rtpForm.nextReviewDate" type="date" value-format="YYYY-MM-DD" style="width: 100%"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRtpDialog = false">取 消</el-button>
        <el-button type="primary" @click="submitRtp">保 存</el-button>
      </template>
    </el-dialog>

    <!-- ========== PHV 手动输入对话框 ========== -->
    <el-dialog title="手动输入 PHV 计算参数" v-model="showPhvDialog" width="520px">
      <el-form :model="phvForm" label-width="100px">
        <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
          留空的字段将自动从运动员档案和最新体态测量中获取
        </el-alert>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="测量日期"><el-date-picker v-model="phvForm.measureDate" type="date" value-format="YYYY-MM-DD" style="width: 100%"/></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="精确年龄(岁)">
            <el-input-number v-model="phvForm.decimalAge" :precision="4" :step="0.01" :min="0" style="width: 100%" placeholder="自动计算"/>
          </el-form-item></el-col>
          <el-col :span="12"><el-form-item label="身高(cm)"><el-input-number v-model="phvForm.height" :precision="1" :min="0" style="width: 100%" placeholder="自动获取"/></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="坐高(cm)"><el-input-number v-model="phvForm.sitHeight" :precision="1" :min="0" style="width: 100%" placeholder="自动获取"/></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="体重(kg)"><el-input-number v-model="phvForm.weight" :precision="1" :min="0" style="width: 100%" placeholder="自动获取"/></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showPhvDialog = false">取 消</el-button>
        <el-button type="primary" @click="submitPhv">开始计算</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="AthleteDetail">
import { getAthlete } from '@/api/apms/athlete'
import * as athleteGroupApi from '@/api/apms/athleteGroup'
import * as bodyMeasureApi from '@/api/apms/bodyMeasure'
import * as rtpApi from '@/api/apms/rtp'
import * as phvApi from '@/api/apms/phv'
import { listDept } from '@/api/system/dept'
import BodyTrendChart from '@/components/BodyTrendChart/index.vue'
import GenderBadge from '@/components/GenderBadge/index.vue'
import { ageAvatarColor } from '@/utils/athleteAvatar'
import { useDict } from '@/utils/dict'
import { ArrowDown, ArrowLeft, Minus, Plus, Delete, Edit, RefreshLeft, DataLine, InfoFilled, CircleCheck, Warning, CircleClose } from '@element-plus/icons-vue'

const { proxy } = getCurrentInstance()
const route = useRoute()
const { apms_position, apms_athlete_status } = useDict('apms_position', 'apms_athlete_status')

const athleteId = computed(() => Number(route.params.athleteId))
const loading = ref(true)
const activeTab = ref('group')
const showTrend = ref(false)

const tabs = [
  { key: 'group', label: '小组归属' },
  { key: 'body', label: '体态测量' },
  { key: 'rtp', label: 'RTP 参训状态' },
  { key: 'phv', label: 'PHV 生长发育' }
]

// 主数据
const athlete = ref({})
const groupHistory = ref([])
const currentGroup = ref(null)
const bodyMeasures = ref([])
const rtpStatus = ref(null)
const rtpLogs = ref([])
const phvRecords = ref([])

const latestPhv = computed(() => phvRecords.value.length > 0 ? phvRecords.value[0] : null)
const latestBody = computed(() => bodyMeasures.value[0] || {})

// 字典辅助（useDict 返回项字段为 label/value/elTagType）
const positionOptions = computed(() => apms_position.value || [])
const statusOptions = computed(() => apms_athlete_status.value || [])
function positionLabel(val) { return (positionOptions.value.find(d => d.value === val) || {}).label || val }
function statusLabel(val) { return (statusOptions.value.find(d => d.value === val) || {}).label || (val || '—') }

/* 字典 elTagType → rk 徽章色调 */
function toneByListClass(val) {
  const listClass = (statusOptions.value.find(d => d.value === val) || {}).elTagType || ''
  if (listClass.indexOf('danger') >= 0) return 'red'
  if (listClass.indexOf('warning') >= 0) return 'amber'
  if (listClass.indexOf('success') >= 0) return 'green'
  return 'gray'
}
const athleteStatusTone = computed(() => toneByListClass(athlete.value.status))


// 小组 dept 选项（dept_type 30/40/50）
const groupDeptOptions = ref([])
async function loadGroupDeptOptions() {
  const res = await listDept({ status: '0' })
  groupDeptOptions.value = (res.data || []).filter(d => ['30', '40', '50', 30, 40, 50].includes(d.deptType))
}

// 头像：全站统一，按年龄组取色
const nameChar = computed(() => (athlete.value.name || '?').charAt(0))
const avatarBg = computed(() => ageAvatarColor(athlete.value.age))

// ===== RTP 辅助 =====
const RTP_TONE = { g: 'green', y: 'amber', r: 'red' }
function rtpToneOf(status) { return RTP_TONE[status] || 'gray' }
const rtpTone = computed(() => rtpToneOf(rtpStatus.value && rtpStatus.value.status))
const rtpBanner = computed(() => {
  if (!rtpStatus.value) return null
  if (rtpStatus.value.status === 'y') return { tone: 'amber', label: '限制参训' }
  if (rtpStatus.value.status === 'r') return { tone: 'red', label: '不建议参训' }
  return null
})
function rtpLabel(status) {
  const map = { g: '正常参训', y: '限制参训', r: '不建议参训' }
  return map[status] ?? (status ? status : '未评估')
}
function rtpIcon(status) {
  const map = { g: CircleCheck, y: Warning, r: CircleClose }
  return map[status] || Warning
}

// ===== 展示格式化 =====
function num(v) { return v != null && v !== '' ? v : '—' }
function fmtLeg(row, digits) {
  if (row.legLength != null) return Number(row.legLength).toFixed(digits || 1)
  if (row.height != null && row.sitHeight != null) return (Number(row.height) - Number(row.sitHeight)).toFixed(1)
  return '—'
}
function sourceLabel(s) {
  return { manual: '手动录入', csv: 'CSV导入', task: '任务流程' }[s] || (s || '—')
}
function groupTypeCls(name) {
  if (name === '训练小组') return 'dt-train'
  if (name === '科研小组') return 'dt-research'
  return 'dt-other'
}
function fmtOffset(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return (n > 0 ? '+' : '') + n.toFixed(4)
}
function offsetClass(v) {
  if (v == null || v === '') return ''
  return Number(v) < 0 ? 'ad-num-warn' : 'ad-num-ok'
}

// ===== 主加载 =====
async function loadAll() {
  loading.value = true
  try {
    const athletePromise = getAthlete(athleteId.value).then(r => { athlete.value = r.data || {} })
    const groupPromise = athleteGroupApi.listByAthlete(athleteId.value).then(r => {
      groupHistory.value = r.data || []
      currentGroup.value = groupHistory.value.find(g => g.status === '0' && g.leaveDate == null) || null
    })
    const bodyPromise = bodyMeasureApi.listByAthlete(athleteId.value).then(r => { bodyMeasures.value = r.data || [] })
    const rtpStatusPromise = rtpApi.getStatus(athleteId.value).then(r => { rtpStatus.value = r.data || null })
    const rtpLogPromise = rtpApi.getLog(athleteId.value).then(r => { rtpLogs.value = r.data || [] })
    const phvPromise = phvApi.listByAthlete(athleteId.value).then(r => { phvRecords.value = r.data || [] })

    await Promise.all([athletePromise, groupPromise, bodyPromise, rtpStatusPromise, rtpLogPromise, phvPromise])
  } catch (e) {
    console.error('load detail failed', e)
    proxy.$modal.msgError('加载详情失败')
  } finally {
    loading.value = false
  }
}

// ===== 小组 =====
const showJoinDialog = ref(false)
const joinForm = reactive({ deptId: null, joinDate: new Date().toISOString().slice(0, 10) })
function submitJoin() {
  if (!joinForm.deptId) return proxy.$modal.msgWarning('请选择目标小组')
  athleteGroupApi.joinGroup({ athleteId: athleteId.value, deptId: joinForm.deptId, joinDate: joinForm.joinDate }).then(() => {
    proxy.$modal.msgSuccess('加入成功')
    showJoinDialog.value = false
    loadAll()
  })
}
function handleLeave() {
  proxy.$modal.confirm('确认让 ' + athlete.value.name + ' 离开当前小组？').then(() => {
    return athleteGroupApi.leaveGroup(athleteId.value, { leaveDate: new Date().toISOString().slice(0, 10) })
  }).then(() => { loadAll(); proxy.$modal.msgSuccess('已离开') }).catch(() => {})
}

// ===== 体态测量 =====
const showBodyDialog = ref(false)
const bodyForm = reactive({ measureDate: new Date().toISOString().slice(0, 10), height: null, sitHeight: null, weight: null, bodyFatRate: null, waist: null, dataSource: 'manual', athleteId: athleteId.value })
function openBodyMeasureDialog() {
  const latest = bodyMeasures.value[0]
  if (latest) {
    bodyForm.height = latest.height
    bodyForm.sitHeight = latest.sitHeight
    bodyForm.weight = latest.weight
  }
  bodyForm.measureDate = new Date().toISOString().slice(0, 10)
  showBodyDialog.value = true
}
function submitBody() {
  if (!bodyForm.height && !bodyForm.weight) return proxy.$modal.msgWarning('请至少填写身高或体重')
  bodyMeasureApi.upsert({ ...bodyForm, athleteId: athleteId.value }).then(() => {
    proxy.$modal.msgSuccess('保存成功')
    showBodyDialog.value = false
    loadAll()
  })
}
function handleDeleteMeasure(row) {
  proxy.$modal.confirm('确认删除该条测量记录？').then(() => {
    return bodyMeasureApi.delMeasure(row.id)
  }).then(() => { loadAll(); proxy.$modal.msgSuccess('已删除') }).catch(() => {})
}

// ===== RTP =====
const showRtpDialog = ref(false)
const rtpForm = reactive({ athleteId: athleteId.value, status: 'g', reason: '', trainingLimit: '', nextReviewDate: null })
function submitRtp() {
  rtpApi.updateStatus({ ...rtpForm, athleteId: athleteId.value }).then(() => {
    proxy.$modal.msgSuccess('更新成功')
    showRtpDialog.value = false
    loadAll()
  })
}
function handleClearRtp() {
  proxy.$modal.confirm('确认清除 RTP 状态（恢复为未评估）？').then(() => {
    return rtpApi.clearStatus(athleteId.value, { reason: '手动清除' })
  }).then(() => { loadAll(); proxy.$modal.msgSuccess('已清除') }).catch(() => {})
}

// ===== PHV =====
const showPhvDialog = ref(false)
const phvForm = reactive({ measureDate: null, decimalAge: null, height: null, sitHeight: null, weight: null })
function handlePhvDropdown(measure) {
  phvApi.calculate({ athleteId: athleteId.value, measureId: measure.id }).then(() => {
    proxy.$modal.msgSuccess('PHV 计算完成')
    loadAll()
  })
}
function submitPhv() {
  const input = { athleteId: athleteId.value, ...phvForm }
  phvApi.calculateDirect(input).then(() => {
    proxy.$modal.msgSuccess('PHV 计算完成')
    showPhvDialog.value = false
    loadAll()
  })
}
function handleDeletePhv(row) {
  proxy.$modal.confirm('确认删除该条 PHV 记录？').then(() => {
    return phvApi.delPhv(row.id)
  }).then(() => { loadAll(); proxy.$modal.msgSuccess('已删除') }).catch(() => {})
}

function goBack() {
  proxy.$router.push('/apms/athlete')
}

// 初始化
loadGroupDeptOptions()
loadAll()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.ad-card-gap { margin-top: 14px; }

.ad-cell-strong { font-weight: 600; color: $rk-text-1; }
.rk-text-2 { color: $rk-text-2; }
.rk-text-3 { color: $rk-text-3; }

/* 小组类型 chip */
.dt-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  font-size: 12px;
  line-height: 18px;
  border: 1px solid;
  border-radius: 999px;
  white-space: nowrap;
}
.dt-train { color: $rk-brand-600; background: $rk-brand-50; border-color: #bfdbfe; }
.dt-research { color: $rk-ok; background: #e8f7ee; border-color: #b7e4c7; }
.dt-other { color: $rk-warn; background: #fef3e0; border-color: #f5d9a8; }

/* RTP 变更箭头 */
.ad-arrow { margin: 0 6px; color: $rk-text-3; font-size: 12px; }

/* 行内图标钮 */
.ad-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: $rk-text-3;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background .12s, color .12s;
  &:hover { background: $rk-canvas; color: $rk-text-1; }
}
.ad-icon-danger:hover { background: #fef2f2; color: $rk-risk; }

/* PHV 数值色 */
.ad-num-ok { color: $rk-ok; }
.ad-num-warn { color: $rk-warn; }
.ad-violet { color: #8b5cf6; }

/* 下拉钮内箭头 */
.ad-caret { margin-left: 2px; font-size: 12px; }
</style>
