<template>
  <section class="rw-panel">
    <div class="ha-section-head">
      <h2 class="ha-section-title">RTP 风险预警</h2>
      <p class="ha-section-sub">
        每日 07:00 自动扫描 · 健康风险（建议红/黄）与流程待办（复检逾期/临近）分开呈现 ·
        系统只给建议，红黄绿由康复师人工确认
      </p>
      <el-button class="rk-btn ha-rules-btn" @click="openRulesDrawer">
        <el-icon><Document /></el-icon>预警规则
      </el-button>
      <el-button type="primary" class="rk-btn rk-btn-primary ha-scan-btn" :loading="scanning"
                 @click="handleScan" v-hasPermi="['apms:rtpRisk:scan']">
        <el-icon><Aim /></el-icon>立即扫描
      </el-button>
    </div>

    <!-- ===== KPI 卡带（5 张） ===== -->
    <div class="rk-kpi-grid is-5">
      <div class="rk-kpi-card" v-for="k in kpiCards" :key="k.label"
           :class="{ 'is-active': filters.level === k.level && !filters.overdueOnly }"
           @click="pickLevel(k.level)">
        <span class="rk-kpi-accent" :style="{ background: k.accent }"></span>
        <div class="rk-kpi-label">{{ k.label }}</div>
        <div class="rk-kpi-value">{{ k.value }}<span class="rk-kpi-unit">条</span></div>
        <span class="rk-kpi-chip" :class="k.chipTone">{{ k.chip }}</span>
      </div>
    </div>

    <!-- ===== 筛选 ===== -->
    <div class="rk-filter rw-filter">
      <label class="rk-group">
        <span class="rk-label">建议级别</span>
        <select v-model="filters.level" class="rk-select rw-select">
          <option value="">全部级别</option>
          <option value="WARNING">建议停训（红）</option>
          <option value="ATTENTION">建议限制（黄）</option>
          <option value="INFO_HEALTH">健康关注（INFO）</option>
          <option value="PROCESS">流程提醒（不计健康分）</option>
        </select>
      </label>
      <label class="rk-group">
        <span class="rk-label">状态</span>
        <select v-model="filters.statusTab" class="rk-select rw-select">
          <option value="ACTIVE">待处理</option>
          <option value="HANDLED">已处理</option>
        </select>
      </label>
      <label class="rk-group">
        <span class="rk-label">队伍</span>
        <select v-model="filters.deptId" class="rk-select rw-select-team">
          <option :value="null">全部队伍</option>
          <option v-for="d in flatDepts" :key="d.deptId" :value="d.deptId">
            {{ '　'.repeat(d.depth) }}{{ d.deptName }}
          </option>
        </select>
      </label>
      <label class="rk-group">
        <span class="rk-label">姓名</span>
        <input v-model="filters.keyword" class="rk-input" type="text" placeholder="队员姓名"/>
      </label>
      <label class="rw-switch-group">
        <input type="checkbox" v-model="filters.overdueOnly" class="rw-switch"/>
        <span>仅看复检逾期</span>
      </label>
      <div class="rk-filter-right">
        <button type="button" class="rk-btn-reset" @click="resetFilter">
          <el-icon><RefreshLeft /></el-icon>重置
        </button>
      </div>
    </div>

    <!-- ===== 待办表 ===== -->
    <div v-loading="loading" class="rk-table-card">
      <div class="rk-table-scroll">
        <table class="rk-table rw-table">
          <thead>
            <tr>
              <th>队员</th>
              <th class="text-center col-level">级别</th>
              <th class="text-center col-score">健康分</th>
              <th>触发因子</th>
              <th class="text-center col-date">快照日期</th>
              <th class="text-center col-status">状态</th>
              <th class="text-right col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in rows" :key="row.id" class="rk-row"
                :class="{ 'is-zebra': idx % 2 === 1 }" @click="openDrawer(row)">
              <td>
                <div class="rk-person">
                  <span class="rk-avatar rw-avatar" :style="{ background: avatarColor(row) }">
                    {{ (row.athleteName || '?').charAt(0) }}
                  </span>
                  <div class="rk-person-meta">
                    <span class="rk-person-main">
                      {{ row.athleteName || '—' }}
                      <GenderBadge :gender="row.athleteGender" :size="14"/>
                    </span>
                    <span class="rk-person-sub">{{ row.athleteTeam || '无队伍' }} · #{{ row.athleteId }}</span>
                  </div>
                </div>
              </td>
              <td class="text-center">
                <span class="rw-level-badge" :class="levelBadgeClass(row)">
                  <el-icon v-if="row.processOnly === '1'" class="rw-badge-ic"><Clock /></el-icon>
                  <i v-else class="rk-status-dot"></i>{{ levelLabel(row) }}
                </span>
                <div v-if="overdueDays(row) != null" class="rw-overdue-sub">逾期 {{ overdueDays(row) }} 天</div>
              </td>
              <td class="text-center rk-mono">
                <span :class="{ 'rw-score-zero': row.processOnly === '1' }">
                  {{ row.processOnly === '1' ? '—' : Number(row.riskScore).toFixed(1) }}
                </span>
              </td>
              <td>
                <div class="rw-chips">
                  <span v-for="f in (row.factorList || [])" :key="f.code"
                        class="rw-factor-chip" :class="f.kind === 'PROCESS' ? 'is-process' : 'is-health'">
                    {{ f.title }}
                  </span>
                </div>
              </td>
              <td class="text-center rk-mono">{{ row.snapshotDate }}</td>
              <td class="text-center">
                <span class="rk-soft-chip" :class="statusChipClass(row.status)">{{ statusLabel(row.status) }}</span>
              </td>
              <td class="text-right" @click.stop>
                <div class="rk-actions">
                  <button type="button" class="rk-link" @click="openDrawer(row)">查看/处置</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && rows.length === 0" class="rk-empty">
          <p class="rk-empty-title">暂无{{ filters.statusTab === 'ACTIVE' ? '待处理' : '已处理' }}预警</p>
          <p class="rk-empty-desc">系统每日自动扫描，也可点右上角「立即扫描」即时生成</p>
        </div>
      </div>

      <RkPager v-if="total > 0"
               :page="query.pageNum" :total="total" :page-size="query.pageSize"
               unit="条" @update:page="goPage"/>
    </div>

    <!-- ========== 因子详情抽屉 ========== -->
    <el-drawer v-model="drawer" size="500px" :with-header="false" class="rw-drawer-wrap" :style="drawerPanelStyle">
      <div class="rw-drawer" v-if="current">
        <div class="rw-drawer-head">
          <div class="rw-drawer-title">
            <span class="rk-avatar rw-avatar-lg" :style="{ background: avatarColor(current) }">
              {{ (current.athleteName || '?').charAt(0) }}
            </span>
            <div>
              <div class="rw-drawer-name">
                {{ current.athleteName || '—' }}
                <GenderBadge :gender="current.athleteGender" :size="15"/>
              </div>
              <div class="rw-drawer-sub">{{ current.athleteTeam || '无队伍' }} · #{{ current.athleteId }} · {{ current.snapshotDate }}</div>
            </div>
          </div>
          <button type="button" class="rt-drawer-close" @click="drawer = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>

        <!-- 系统建议 -->
        <div class="rw-suggest-panel" :class="panelTone(current)">
          <div class="rw-suggest-label">系统建议（供参考，不自动改变 RTP 状态）</div>
          <div class="rw-suggest-main">
            <span class="rw-level-badge lg" :class="levelBadgeClass(current)">
              <el-icon v-if="current.processOnly === '1'" class="rw-badge-ic"><Clock /></el-icon>
              <i v-else class="rk-status-dot"></i>{{ levelLabel(current) }}
            </span>
            <span class="rw-suggest-score">健康分
              <b>{{ current.processOnly === '1' ? '0（纯流程待办）' : Number(current.riskScore).toFixed(1) }}</b>
            </span>
          </div>
          <div class="rw-suggest-rtp" v-if="canAccept(current)">
            采纳将写入 <b :class="current.suggestedLevel === 'WARNING' ? 'txt-red' : 'txt-amber'">
              {{ current.suggestedLevel === 'WARNING' ? '红 · 不建议训练' : '黄 · 限制参训' }}</b>
            <span v-if="currentStatus" class="rw-current-rtp">；当前：{{ rtpStatusLabel(currentStatus.status) }}</span>
          </div>
        </div>

        <!-- 因子明细 -->
        <div class="rw-section-title">
          触发因子（{{ (current.factorList || []).length }}）
          <span class="rw-section-sub">HEALTH 计健康分 · PROCESS 仅排序</span>
        </div>
        <div class="rw-factor-list">
          <div v-for="f in (current.factorList || [])" :key="f.code"
               class="rw-factor-card" :class="f.kind === 'PROCESS' ? 'is-process' : 'is-health'">
            <div class="rw-factor-head">
              <span class="rw-factor-kind" :class="f.kind === 'PROCESS' ? 'is-process' : 'is-health'">
                {{ f.kind === 'PROCESS' ? '流程' : '健康' }}
              </span>
              <span class="rw-factor-title">{{ f.title }}</span>
              <span class="rw-factor-meta">
                <template v-if="f.kind === 'HEALTH'">严重度 {{ f.severity }}</template>
                紧迫 {{ f.urgency }}
              </span>
            </div>
            <div class="rw-factor-detail">{{ f.detail }}</div>
            <!-- 触发该因子的规则口径（阈值参数来自规则配置，让用户知道"为什么会预警"） -->
            <div v-if="ruleBasis(f.code)" class="rw-factor-basis">
              <el-icon><InfoFilled /></el-icon>
              <span>规则口径：{{ ruleBasis(f.code) }}</span>
            </div>
          </div>
        </div>

        <!-- 已处理留痕 -->
        <div v-if="current.status !== 'ACTIVE'" class="rw-handled">
          <span class="rk-soft-chip" :class="statusChipClass(current.status)">{{ statusLabel(current.status) }}</span>
          {{ current.handledBy || '—' }} · {{ formatDT(current.handledTime) }}
          <span v-if="current.handleRemark"> · {{ current.handleRemark }}</span>
        </div>

        <!-- 底部操作 -->
        <div class="rk-drawer-foot" v-if="current.status === 'ACTIVE'">
          <template v-if="current.suggestedLevel === 'INFO'">
            <button type="button" class="rk-btn rk-btn-sm" :loading="acting"
                    @click="handleAck" v-hasPermi="['apms:rtpRisk:handle']">已知悉</button>
            <button type="button" class="rk-btn rk-btn-sm rk-btn-danger" :loading="acting"
                    @click="handleDismiss" v-hasPermi="['apms:rtpRisk:handle']">忽略</button>
          </template>
          <template v-else>
            <button type="button" class="rk-btn rk-btn-sm rk-btn-primary" :loading="acting"
                    :disabled="stricterCurrent" :title="stricterCurrent ? '当前为更严格状态，无需下调' : ''"
                    v-if="canAccept(current) && checkRtpEdit"
                    @click="openAcceptDialog">采纳并更新 RTP</button>
            <span v-if="canAccept(current) && !checkRtpEdit" class="rw-perm-tip">需同时具备风险处置与 RTP 评估权限</span>
            <span v-if="stricterCurrent" class="rw-perm-tip">当前为更严格状态（{{ rtpStatusLabel(currentStatus.status) }}），无需下调</span>
            <button type="button" class="rk-btn rk-btn-sm rk-btn-danger" :loading="acting"
                    @click="handleDismiss" v-hasPermi="['apms:rtpRisk:handle']">忽略</button>
          </template>
        </div>
      </div>
    </el-drawer>

    <!-- ========== 采纳并更新 RTP 弹窗（单次 HTTP，无 green） ========== -->
    <el-dialog :title="'采纳建议并更新 RTP · ' + (current?.athleteName || '')"
               v-model="acceptDialog" width="520px">
      <el-form :model="acceptForm" label-width="100px">
        <el-form-item label="写入状态">
          <span class="rw-accept-target" :class="acceptForm.status === 'r' ? 'txt-red' : 'txt-amber'">
            {{ acceptForm.status === 'r' ? '🔴 不建议训练' : '🟡 限制参训' }}
          </span>
          <span class="rw-accept-note">（由本次建议级别确定；green 需在 RTP 模块主动评估）</span>
        </el-form-item>
        <el-form-item label="标记原因">
          <el-input v-model="acceptForm.reason" type="textarea" :rows="2"
                    placeholder="如：术后未复查，建议停训就医评估"/>
        </el-form-item>
        <el-form-item label="训练限制">
          <el-input v-model="acceptForm.trainingLimit" placeholder="如：停训 / 避免高强度对抗"/>
        </el-form-item>
        <el-form-item label="下次复检">
          <el-date-picker v-model="acceptForm.nextReviewDate" type="date" value-format="YYYY-MM-DD"
                          placeholder="选择日期" style="width:100%"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="acceptDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitAccept">确认采纳（单次提交）</el-button>
      </template>
    </el-dialog>

    <!-- ========== 预警规则说明抽屉（只读：展示引擎定级方式与各规则阈值口径） ========== -->
    <el-drawer v-model="rulesDrawer" size="520px" :with-header="false" class="rw-drawer-wrap" :style="drawerPanelStyle">
      <div class="rw-drawer" v-loading="rulesLoading">
        <div class="rw-drawer-head">
          <div class="rw-drawer-title">
            <span class="rw-rules-ico"><el-icon><Document /></el-icon></span>
            <div>
              <div class="rw-drawer-name">RTP 预警规则说明</div>
              <div class="rw-drawer-sub">规则引擎每日 07:00 自动扫描 · 以下为当前生效的判定口径</div>
            </div>
          </div>
          <button type="button" class="rt-drawer-close" @click="rulesDrawer = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>

        <!-- 定级方式 -->
        <div class="rw-rules-intro">
          <div class="rw-rules-intro-title">系统如何给出建议级别</div>
          <ul class="rw-rules-steps">
            <li><b>健康因子</b>（伤病未闭环、PHV 峰期等）按「严重度 × 权重」累加<b>健康分</b>；<b>流程因子</b>（复检逾期/临近）只生成待办，<b>不计健康分</b>，不会单独推高到黄/红。</li>
            <li>健康分 ≥ 9 → 建议<b class="txt-red">停训（红）</b>；≥ 6 → 建议<b class="txt-amber">限制（黄）</b>；≥ 3 或存在任意健康因子 → 健康关注（INFO）。</li>
            <li>个别高危因子（如术后未闭环）可<b>直接建议红色</b>，不依赖累计分。</li>
            <li>系统只给建议，红黄绿状态始终由康复师在处置时人工确认。</li>
          </ul>
        </div>

        <!-- 规则卡列表 -->
        <div class="rw-section-title">
          规则清单
          <span class="rw-section-sub">{{ enabledRuleCount }} 条生效 · 共 {{ rules.length }} 条</span>
        </div>
        <div class="rw-rule-list">
          <div v-for="r in rules" :key="r.id" class="rw-rule-card" :class="{ 'is-off': r.enabled !== '1' }">
            <div class="rw-rule-head">
              <span class="rw-factor-kind" :class="r.kind === 'PROCESS' ? 'is-process' : 'is-health'">
                {{ r.kind === 'PROCESS' ? '流程' : '健康' }}
              </span>
              <span class="rw-rule-name">{{ r.ruleName }}</span>
              <span class="rw-rule-status">
                {{ r.enabled === '1' ? '生效中' : '已停用' }}
              </span>
            </div>
            <div class="rw-rule-code rk-mono">{{ r.ruleCode }}</div>
            <div class="rw-rule-desc">{{ ruleDescription(r) }}</div>
            <div class="rw-rule-meta">
              <template v-if="r.kind === 'HEALTH'">
                <span>严重度 <b>{{ r.severity }}</b></span>
                <span>权重 <b>{{ r.weight }}</b></span>
                <span>可直推红色 <b>{{ r.forceWarning === '1' ? '是' : '否' }}</b></span>
              </template>
              <span>紧迫度 <b>{{ r.urgency }}</b></span>
            </div>
          </div>
          <div v-if="!rulesLoading && rules.length === 0" class="rk-empty">
            <p class="rk-empty-title">未加载到规则配置</p>
            <p class="rk-empty-desc">请稍后重试，或联系系统管理员检查规则引擎配置</p>
          </div>
        </div>

        <div class="rw-rules-foot">
          <el-icon><InfoFilled /></el-icon>
          阈值与权重一期由系统统一配置维护，确保各机构判定口径一致；如需调整规则参数，请联系系统管理员通过配置变更处理，后续版本将开放在线编辑。
        </div>
      </div>
    </el-drawer>
  </section>
</template>

<script setup name="RtpWarningPanel">
import { listRisk, statRisk, getRisk, ackRisk, dismissRisk, acceptRisk, scanAll, listRules } from '@/api/apms/rtpRisk'
import { getStatus as getRtpStatus } from '@/api/apms/rtp'
import { listDept } from '@/api/system/dept'
import { checkPermi } from '@/utils/permission'
import { Close, RefreshLeft, Aim, Clock, Document, InfoFilled } from '@element-plus/icons-vue'
import GenderBadge from '@/components/GenderBadge/index.vue'
import RkPager from '@/components/RkPager/index.vue'
import { ageAvatarColor } from '@/utils/athleteAvatar'
import { useDrawerOffset } from '@/utils/drawerOffset'

const emit = defineEmits(['accepted'])

const { proxy } = getCurrentInstance()

const { drawerPanelStyle } = useDrawerOffset()

const checkRtpEdit = checkPermi(['apms:rtpRisk:handle']) && checkPermi(['apms:rtp:edit'])

// ========= 展示字典 =========
function levelLabel(row) {
  if (!row) return '—'
  if (row.processOnly === '1') return '流程提醒'
  if (row.suggestedLevel === 'WARNING') return '建议停训'
  if (row.suggestedLevel === 'ATTENTION') return '建议限制'
  return '健康关注'
}
function levelBadgeClass(row) {
  if (row.processOnly === '1') return 'rw-badge-process'
  if (row.suggestedLevel === 'WARNING') return 'tone-red'
  if (row.suggestedLevel === 'ATTENTION') return 'tone-amber'
  return 'rw-badge-info'
}
function panelTone(row) {
  if (row.processOnly === '1') return 'is-process'
  if (row.suggestedLevel === 'WARNING') return 'is-red'
  if (row.suggestedLevel === 'ATTENTION') return 'is-amber'
  return 'is-info'
}
function statusLabel(s) {
  return { ACTIVE: '待处理', ACKED: '已知悉', ACCEPTED: '已采纳', DISMISSED: '已忽略', EXPIRED: '已过期' }[s] || s
}
function statusChipClass(s) {
  if (s === 'ACCEPTED') return 'rw-chip-green'
  if (s === 'ACTIVE') return 'rw-chip-blue'
  return ''
}
function rtpStatusLabel(s) {
  return s === 'g' ? '正常参训' : s === 'y' ? '限制参训' : s === 'r' ? '不建议训练' : '未评估'
}
function avatarColor(row) { return ageAvatarColor(row.athleteAge) }
function formatDT(d) { return d ? String(d).substring(0, 19).replace('T', ' ') : '—' }
function overdueDays(row) {
  const f = (row.factorList || []).find(x => x.code === 'REVIEW_OVERDUE')
  return f ? f.refData?.daysOverdue : null
}

// ========= 数据 =========
const loading = ref(false)
const scanning = ref(false)
const acting = ref(false)
const rows = ref([])
const total = ref(0)
const stats = reactive({ total: 0, warning: 0, attention: 0, infoHealth: 0, processOnly: 0 })

// ========= 规则配置（只读展示：页头「预警规则」抽屉 + 因子卡口径行共用） =========
const rules = ref([])
const rulesLoading = ref(false)
const rulesDrawer = ref(false)
let rulesPromise = null
function loadRules() {
  // 全页面只拉一次（4 条配置，接口很轻）；并发调用复用同一 Promise
  if (rulesPromise) return rulesPromise
  rulesLoading.value = true
  rulesPromise = listRules().then(res => {
    rules.value = res.data || []
  }).catch(() => {
    rulesPromise = null // 失败后允许重试
  }).finally(() => { rulesLoading.value = false })
  return rulesPromise
}
function openRulesDrawer() {
  rulesDrawer.value = true
  loadRules()
}
const ruleMap = computed(() => {
  const m = {}
  rules.value.forEach(r => { m[r.ruleCode] = r })
  return m
})
const enabledRuleCount = computed(() => rules.value.filter(r => r.enabled === '1').length)

/** 解析规则 params JSON（后端存 JSON 字符串，异常时兜底空对象） */
function ruleParams(r) {
  try { return JSON.parse(r?.params || '{}') || {} } catch { return {} }
}

/**
 * 规则口径的人类可读说明：阈值参数取自规则配置，保证与引擎实际判定一致；
 * 未识别的新规则回退展示参数键值，不吞信息
 */
function ruleDescription(r) {
  if (!r) return ''
  const p = ruleParams(r)
  switch (r.ruleCode) {
    case 'REVIEW_OVERDUE':
      return 'RTP 状态中登记的「下次复检」日期已过，但状态尚未更新。生成流程待办提醒康复师跟进处置；不计健康分，不会单独触发红/黄建议。'
    case 'REVIEW_SOON':
      return `距下次复检日期不足 ${p.reviewSoonDays ?? 14} 天时提前提醒，便于安排复检计划；仅用于待办排序，不计健康分。`
    case 'INJURY_OPEN':
      return `近 ${p.injuryWindowDays ?? 45} 天内有损伤/手术记录且未闭环（${p.closureWindowDays ?? 90} 天内无复查记录）即命中。普通损伤按严重度 2 计分；手术按严重度 3 计分并可直接建议红色。健康分 = 严重度 × 权重。`
    case 'PHV_PEAK':
      return `最新 PHV 成熟度偏移在 ±${p.phvPeakBand ?? 0.5} 岁以内、且测量时间在 ${p.phvFreshDays ?? 180} 天内（处于身高突增峰期）时命中，提示关注训练负荷安排，按严重度 1 计分。`
    default: {
      const keys = Object.keys(p)
      return keys.length
        ? '自定义规则，参数：' + keys.map(k => `${k}=${p[k]}`).join('；')
        : '系统内置规则，无额外阈值参数。'
    }
  }
}
/** 详情抽屉因子卡上的短口径（复用规则说明） */
function ruleBasis(code) {
  return ruleDescription(ruleMap.value[code])
}

const query = reactive({ pageNum: 1, pageSize: 10 })
const filters = reactive({ level: '', statusTab: 'ACTIVE', deptId: null, keyword: '', overdueOnly: false })
const deptOpts = ref([])

const flatDepts = computed(() => {
  const out = []
  const walk = (nodes, depth) => {
    (nodes || []).forEach(n => {
      out.push({ deptId: n.deptId, deptName: n.deptName, depth })
      if (n.children && n.children.length) walk(n.children, depth + 1)
    })
  }
  walk(deptOpts.value, 0)
  return out
})

const kpiCards = computed(() => [
  { label: '待处理总数', value: stats.total, accent: '#2563EB', chip: '当日 ACTIVE', chipTone: '', level: '' },
  { label: '建议停训（红）', value: stats.warning, accent: '#DC2626', chip: 'WARNING', chipTone: 'tone-risk', level: 'WARNING' },
  { label: '建议限制（黄）', value: stats.attention, accent: '#D97706', chip: 'ATTENTION', chipTone: 'tone-warn', level: 'ATTENTION' },
  { label: '健康关注', value: stats.infoHealth, accent: '#2563EB', chip: 'INFO', chipTone: 'tone-ok', level: 'INFO_HEALTH' },
  { label: '流程提醒', value: stats.processOnly, accent: '#64748B', chip: '复检逾期/临近', chipTone: '', level: 'PROCESS' }
])

function buildParams() {
  const p = { pageNum: query.pageNum, pageSize: query.pageSize }
  if (filters.deptId != null) p.deptId = filters.deptId
  if (filters.keyword.trim()) p.keyword = filters.keyword.trim()
  if (filters.statusTab === 'ACTIVE') p.status = 'ACTIVE'
  else p.status = 'ACKED,ACCEPTED,DISMISSED'
  if (filters.level === 'WARNING' || filters.level === 'ATTENTION') p.suggestedLevel = filters.level
  else if (filters.level === 'INFO_HEALTH') { p.suggestedLevel = 'INFO'; p.processOnly = '0' }
  else if (filters.level === 'PROCESS') p.processOnly = '1'
  if (filters.overdueOnly) p.processFlag = 'REVIEW_OVERDUE'
  return p
}

function loadList() {
  loading.value = true
  listRisk(buildParams()).then(res => {
    rows.value = res.rows || []
    total.value = res.total || 0
  }).finally(() => { loading.value = false })
}

function loadStat() {
  const p = {}
  if (filters.deptId != null) p.deptId = filters.deptId
  if (filters.keyword.trim()) p.keyword = filters.keyword.trim()
  statRisk(p).then(res => {
    Object.assign(stats, res.data || {})
  })
}

function reloadFirst() { query.pageNum = 1; loadList(); loadStat() }

function goPage(p) {
  query.pageNum = p
  loadList()
}

// 筛选统一 300ms 防抖（含姓名输入）；重置用 guard 避免与 watcher 重复请求
let filterTimer = null
let filterGuard = false
watch(filters, () => {
  if (filterGuard) return
  clearTimeout(filterTimer)
  filterTimer = setTimeout(reloadFirst, 300)
}, { deep: true })

function resetFilter() {
  filterGuard = true
  filters.level = ''
  filters.statusTab = 'ACTIVE'
  filters.deptId = null
  filters.keyword = ''
  filters.overdueOnly = false
  nextTick(() => { filterGuard = false; reloadFirst() })
}

function pickLevel(level) {
  // 两个字段连续赋值只触发一次防抖请求
  filters.level = (filters.level === level && !filters.overdueOnly) ? '' : level
  filters.statusTab = 'ACTIVE'
}

function handleScan() {
  proxy.$modal.confirm('立即对全部在训运动员执行一次风险扫描？将生成/刷新当日快照。', '立即扫描').then(() => {
    scanning.value = true
    scanAll().then(res => {
      const s = res.data || {}
      proxy.$modal.msgSuccess(`扫描完成：共 ${s.total ?? 0} 人，${s.withRisk ?? 0} 人存在风险/待办`)
      query.pageNum = 1
      loadList()
      loadStat()
    }).finally(() => { scanning.value = false })
  }).catch(() => {})
}

// ========= 抽屉与处置 =========
const drawer = ref(false)
const current = ref(null)
const currentStatus = ref(null)

function canAccept(row) {
  return row && (row.suggestedLevel === 'ATTENTION' || row.suggestedLevel === 'WARNING')
}
const stricterCurrent = computed(() => {
  if (!canAccept(current.value) || !currentStatus.value) return false
  const rank = { r: 3, y: 2, g: 1 }
  const target = current.value.suggestedLevel === 'WARNING' ? 'r' : 'y'
  return (rank[currentStatus.value.status] || 0) > rank[target]
})

function openDrawer(row) {
  current.value = row
  currentStatus.value = null
  drawer.value = true
  // 规则口径（懒加载一次，已加载则为同一 Promise 直接 resolve）
  loadRules()
  // 拉取最新明细（因子留痕）+ 当前 RTP（不降级判断）
  getRisk(row.id).then(res => { current.value = res.data || row })
  if (canAccept(row) && checkRtpEdit) {
    getRtpStatus(row.athleteId).then(res => { currentStatus.value = res.data || null }).catch(() => {})
  }
}

function refreshAfterAction() {
  loadList()
  loadStat()
}

function handleAck() {
  proxy.$prompt('可补充备注（可选）', '标记已知悉', {
    inputType: 'textarea', inputPlaceholder: '如：已线下提醒队员按时复检',
    confirmButtonText: '确认', cancelButtonText: '取消'
  }).then(({ value }) => {
    acting.value = true
    ackRisk(current.value.id, value || null).then(() => {
      proxy.$modal.msgSuccess('已标记知悉')
      drawer.value = false
      refreshAfterAction()
    }).finally(() => { acting.value = false })
  }).catch(() => {})
}

function handleDismiss() {
  proxy.$prompt('请填写忽略理由（必填）', '忽略该预警', {
    inputType: 'textarea', inputPlaceholder: '如：伤病已在其他机构闭环，系统未采集到复查记录',
    confirmButtonText: '确认忽略', cancelButtonText: '取消'
  }).then(({ value }) => {
    if (!value || !value.trim()) {
      proxy.$modal.msgError('忽略必须填写理由')
      return
    }
    acting.value = true
    dismissRisk(current.value.id, value.trim()).then(() => {
      proxy.$modal.msgSuccess('已忽略')
      drawer.value = false
      refreshAfterAction()
    }).finally(() => { acting.value = false })
  }).catch(() => {})
}

// ========= 采纳（单接口单事务） =========
const acceptDialog = ref(false)
const saving = ref(false)
const acceptForm = reactive({ status: 'y', reason: '', trainingLimit: '', nextReviewDate: null })

function openAcceptDialog() {
  const row = current.value
  acceptForm.status = row.suggestedLevel === 'WARNING' ? 'r' : 'y'
  acceptForm.reason = '风险预警采纳：' + (row.factorList || []).map(f => f.title).join('；')
  acceptForm.trainingLimit = acceptForm.status === 'r' ? '建议停训，就医评估' : '限制参训，避免高强度'
  acceptForm.nextReviewDate = null
  acceptDialog.value = true
}

function submitAccept() {
  saving.value = true
  acceptRisk(current.value.id, {
    status: acceptForm.status,
    reason: acceptForm.reason || null,
    trainingLimit: acceptForm.trainingLimit || null,
    nextReviewDate: acceptForm.nextReviewDate || null
  }).then(() => {
    proxy.$modal.msgSuccess('已采纳：RTP 状态、变更日志与预警处置在同一事务完成')
    acceptDialog.value = false
    drawer.value = false
    refreshAfterAction()
    // 通知合并页刷新上方 RTP 状态面板
    emit('accepted')
  }).finally(() => { saving.value = false })
}

// ========= 初始化 =========
listDept({ pageNum: 1, pageSize: 500 }).then(res => {
  deptOpts.value = Array.isArray(res.data) ? res.data : []
})
loadList()
loadStat()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.rw-panel {
  background: #fff;
  border: 1px solid $rk-line;
  border-radius: 16px;
  padding: 20px 22px 24px;
}

/* 面板区块头（合并页中充当分区标题） */
.ha-section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-bottom: 16px;
}
.ha-section-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: $rk-text-1;
  position: relative;
  padding-left: 10px;
  &::before {
    content: '';
    position: absolute;
    left: 0; top: 50%;
    transform: translateY(-50%);
    width: 4px; height: 16px;
    border-radius: 2px;
    background: $rk-brand-600;
  }
}
.ha-section-sub {
  margin: 0;
  flex: 1 1 100%;
  order: 2;
  font-size: 12px;
  color: $rk-text-3;
}
.ha-rules-btn { margin-left: auto; flex: none; }
.ha-scan-btn { flex: none; }

.rw-select { width: 160px; }
.rw-select-team { width: 150px; }
.rw-avatar { width: 30px; height: 30px; font-size: 13px; }
.rw-avatar-lg { width: 44px; height: 44px; font-size: 18px; }

.rw-switch-group {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: $rk-text-2; cursor: pointer; white-space: nowrap;
}
.rw-switch { accent-color: $rk-brand-600; }

/* ===== 级别徽标：健康暖色 / 流程中性灰蓝 ===== */
.rw-level-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600; line-height: 18px;
  border: 1px solid transparent; white-space: nowrap;
  &.lg { font-size: 14px; padding: 6px 14px; }
  .rw-badge-ic { font-size: 14px; }
}
.rw-badge-process { background: #eef2f7; border-color: #dbe3ee; color: #5b6b7f; }
.rw-badge-info { background: #e8f1fe; border-color: #bfd9fb; color: #1d5bb8; }
.rw-overdue-sub { margin-top: 4px; font-size: 11px; font-weight: 600; color: #b45309; }
.rw-score-zero { color: $rk-text-3; }

.rw-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rw-factor-chip {
  display: inline-flex; align-items: center;
  padding: 2px 9px; border-radius: 8px; font-size: 12px;
  border: 1px solid transparent;
}
.rw-factor-chip.is-health { background: #fef3e0; border-color: #f5d9a8; color: #b45309; }
.rw-factor-chip.is-process { background: #eef2f7; border-color: #dbe3ee; color: #5b6b7f; }

.rw-table .col-level { width: 130px; }
.rw-table .col-score { width: 90px; }
.rw-table .col-date { width: 110px; }
.rw-table .col-status { width: 90px; }
.rw-table .col-actions { width: 100px; }

.rw-chip-blue { background: #e8f1fe; color: #1d5bb8; border-color: #bfd9fb; }
.rw-chip-green { background: #e8f7ee; color: #16A34A; border-color: #b7e4c7; }

/* ===== 抽屉 ===== */
.rw-drawer { display: flex; flex-direction: column; height: 100%; padding: 18px 20px 20px; overflow-y: auto; }
.rw-drawer-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
  padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid $rk-line;
}
.rw-drawer-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.rw-drawer-name { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: $rk-text-1; }
.rw-drawer-sub { margin-top: 4px; font-size: 12px; color: $rk-text-3; }
:deep(.rt-drawer-close) {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; flex: none;
  color: $rk-text-3; background: #fff; border: 1px solid $rk-line; border-radius: 9px; cursor: pointer;
  &:hover { background: $rk-canvas; color: $rk-text-1; }
}

.rw-suggest-panel {
  border: 1px solid $rk-line; border-radius: 14px; padding: 14px 16px;
  background: #f8fafc;
  &.is-red { border-left: 4px solid $rk-risk; }
  &.is-amber { border-left: 4px solid $rk-warn; }
  &.is-info { border-left: 4px solid #2563eb; }
  &.is-process { border-left: 4px solid #94a3b8; }
}
.rw-suggest-label { font-size: 12px; color: $rk-text-3; margin-bottom: 8px; }
.rw-suggest-main { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.rw-suggest-score { font-size: 13px; color: $rk-text-2; b { color: $rk-text-1; margin-left: 4px; } }
.rw-suggest-rtp { margin-top: 10px; font-size: 12.5px; color: $rk-text-2; }
.txt-red { color: $rk-risk; }
.txt-amber { color: $rk-warn; }
.rw-current-rtp { color: $rk-text-3; }

.rw-section-title {
  display: flex; align-items: center; gap: 8px;
  margin: 18px 0 12px; padding-left: 9px;
  border-left: 3px solid $rk-brand-600;
  font-size: 13px; font-weight: 600; color: $rk-text-1;
}
.rw-section-sub { margin-left: auto; font-size: 11px; font-weight: 400; color: $rk-text-3; }

.rw-factor-list { display: flex; flex-direction: column; gap: 10px; }
.rw-factor-card {
  border: 1px solid $rk-line; border-radius: 12px; padding: 11px 13px; background: #fff;
  &.is-health { border-left: 3px solid $rk-warn; }
  &.is-process { border-left: 3px solid #94a3b8; }
}
.rw-factor-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.rw-factor-kind {
  font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 6px;
  &.is-health { background: #fef3e0; color: #b45309; }
  &.is-process { background: #eef2f7; color: #5b6b7f; }
}
.rw-factor-title { font-size: 13px; font-weight: 600; color: $rk-text-1; }
.rw-factor-meta { margin-left: auto; font-size: 11px; color: $rk-text-3; white-space: nowrap; }
.rw-factor-detail { font-size: 12.5px; line-height: 19px; color: $rk-text-2; }
/* 因子卡内的规则口径行 */
.rw-factor-basis {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px dashed $rk-line;
  font-size: 11.5px;
  line-height: 17px;
  color: $rk-text-3;
  .el-icon { flex: none; margin-top: 2px; font-size: 13px; color: $rk-brand-600; }
}

/* ===== 预警规则说明抽屉 ===== */
.rw-rules-ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px; height: 44px;
  border-radius: 12px;
  background: $rk-brand-50;
  color: $rk-brand-600;
  font-size: 20px;
}
.rw-rules-intro {
  border: 1px solid #dbe3ee;
  border-radius: 14px;
  padding: 13px 15px;
  background: #f8fafc;
}
.rw-rules-intro-title {
  font-size: 13px;
  font-weight: 700;
  color: $rk-text-1;
  margin-bottom: 8px;
}
.rw-rules-steps {
  margin: 0;
  padding-left: 18px;
  font-size: 12.5px;
  line-height: 20px;
  color: $rk-text-2;
  li { margin-bottom: 5px; }
  li:last-child { margin-bottom: 0; }
}
.rw-rule-list { display: flex; flex-direction: column; gap: 10px; }
.rw-rule-card {
  border: 1px solid $rk-line;
  border-radius: 12px;
  padding: 12px 14px;
  background: #fff;
  &.is-off { background: $rk-canvas; opacity: .72; }
}
.rw-rule-head { display: flex; align-items: center; gap: 8px; }
.rw-rule-name { font-size: 13.5px; font-weight: 600; color: $rk-text-1; }
.rw-rule-status {
  margin-left: auto;
  flex: none;
  font-size: 11px;
  font-weight: 600;
  color: $rk-ok;
  .is-off & { color: $rk-text-3; }
}
.rw-rule-code { font-size: 11px; color: #94a3b8; margin: 3px 0 7px; }
.rw-rule-desc { font-size: 12.5px; line-height: 19px; color: $rk-text-2; }
.rw-rule-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px dashed $rk-line;
  font-size: 11.5px;
  color: $rk-text-3;
  b { color: $rk-text-1; font-weight: 600; margin-left: 2px; }
}
.rw-rules-foot {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f5f8ff;
  font-size: 11.5px;
  line-height: 17px;
  color: #475569;
  .el-icon { flex: none; margin-top: 2px; color: $rk-brand-600; }
}

.rw-handled {
  margin-top: 16px; padding: 10px 12px; border-radius: 10px;
  background: $rk-canvas; font-size: 12.5px; color: $rk-text-2;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}

.rw-perm-tip { font-size: 12px; color: $rk-text-3; }

.rw-accept-target { font-weight: 700; font-size: 14px; }
.rw-accept-note { margin-left: 8px; font-size: 12px; color: $rk-text-3; }

/* KPI 卡可点击 */
.rk-kpi-card { cursor: pointer; }
</style>
