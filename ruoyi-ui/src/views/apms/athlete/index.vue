<template>
  <div class="app-container roster-page">
    <read-only-block :perms="['apms:athlete:edit', 'apms:athlete:add', 'apms:athlete:remove']">
    <!-- ===== 页头（对齐 demo /athletes） ===== -->
    <div class="rp-header">
      <div>
        <h1 class="rp-title">花名册</h1>
        <p class="rp-subtitle">{{ total }} 名在训运动员 · 13–18 岁</p>
      </div>
      <div class="rp-header-actions">
        <el-button
          v-if="ids.length"
          plain
          class="rp-btn-danger"
          @click="handleDelete()"
          v-hasPermi="['apms:athlete:remove']"
        >已选 {{ ids.length }} 人 · 批量离队</el-button>
        <el-button
          plain
          @click="openPromotionDialog"
          v-hasPermi="['apms:athlete:edit']"
        >赛季晋升</el-button>
        <el-button
          type="primary"
          class="rp-btn-primary"
          :icon="Plus"
          @click="handleAdd"
          v-hasPermi="['apms:athlete:add']"
        >新建运动员档案</el-button>
      </div>
    </div>

    <!-- ===== 筛选条（卡片化：年龄组 chips / 位置 / 队伍 / 性别 / RTP chips / 搜索 / 重置） ===== -->
    <div class="rp-filter">
      <div class="rpf-group">
        <span class="rpf-label">年龄段</span>
        <button
          v-for="g in AGE_GROUPS"
          :key="g"
          type="button"
          class="rp-chip rp-chip-group"
          :class="{ 'is-active': filters.groups.includes(g) }"
          @click="toggleGroup(g)"
        >{{ g }}岁</button>
      </div>

      <span class="rpf-divider"></span>

      <label class="rpf-field">
        <span class="rpf-label">位置</span>
        <select v-model="filters.position" class="rp-select">
          <option value="">全部</option>
          <option v-for="d in positionOptions" :key="d.value" :value="d.value">
            {{ d.value }} {{ d.label }}
          </option>
        </select>
      </label>

      <label class="rpf-field">
        <span class="rpf-label">队伍</span>
        <select v-model="filters.primaryTeamId" class="rp-select rp-select-team">
          <option value="">全部队伍</option>
          <option v-for="t in teamOptions" :key="t.deptId" :value="t.deptId">{{ t.deptName }}</option>
        </select>
      </label>

      <label class="rpf-field">
        <span class="rpf-label">性别</span>
        <select v-model="filters.gender" class="rp-select rp-select-xs">
          <option value="">全部</option>
          <option value="M">男</option>
          <option value="F">女</option>
        </select>
      </label>

      <span class="rpf-divider"></span>

      <div class="rpf-group">
        <button
          v-for="c in STATUS_CHIPS"
          :key="c.key"
          type="button"
          class="rp-chip rp-chip-status"
          :class="{ 'is-active': filters.rtpStatus === c.key }"
          @click="filters.rtpStatus = c.key"
        >
          <span v-if="c.dot" class="rp-chip-dot" :style="{ background: c.dot }"></span>
          {{ c.label }}
          <span class="rp-chip-count">{{ countOf(c.key) }}</span>
        </button>
      </div>

      <div class="rpf-right">
        <div class="rp-search">
          <el-icon class="rp-search-icon"><Search /></el-icon>
          <input
            v-model="filters.name"
            class="rp-search-input"
            type="text"
            placeholder="搜索姓名…"
          />
        </div>
        <button type="button" class="rp-btn-reset" @click="resetFilters">
          <el-icon><RefreshLeft /></el-icon>重置
        </button>
      </div>
    </div>

    <!-- ===== 花名册表格卡片 ===== -->
    <div v-loading="loading" class="rp-table-card">
      <div class="rp-table-scroll">
        <table class="rp-table">
          <thead>
            <tr>
              <th class="col-check"></th>
              <th class="text-left">运动员</th>
              <th class="text-left">年龄段</th>
              <th class="text-left">位置</th>
              <th class="text-right">身高 / 体重</th>
              <th class="text-right">体脂率</th>
              <th class="text-left">RTP 状态</th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in athleteList"
              :key="row.athleteId"
              class="rp-row"
              :class="{
                'is-zebra': idx % 2 === 1,
                'row-red': row.rtpStatus === 'r',
                'row-amber': row.rtpStatus === 'y'
              }"
              @click="handleDetail(row)"
            >
              <td class="col-check" @click.stop>
                <input
                  type="checkbox"
                  class="rp-check"
                  :checked="ids.includes(row.athleteId)"
                  @change="toggleRow(row)"
                />
              </td>
              <td>
                <div class="rp-user">
                  <span class="rp-avatar" :style="{ background: groupColor(row) }">{{ row.name.charAt(0) }}</span>
                  <div class="rp-user-meta">
                    <p class="rp-user-name">
                      {{ row.name }}
                      <GenderBadge :gender="row.gender" :size="15" class="rp-gender"/>
                    </p>
                    <p class="rp-user-sub mono">{{ row.teamName || '未分队伍' }} · #{{ row.athleteId }}</p>
                  </div>
                </div>
              </td>
              <td>
                <span
                  v-if="ageGroup(row)"
                  class="rp-age-badge mono"
                  :style="ageBadgeStyle(row)"
                >{{ ageGroup(row) }}岁</span>
                <span v-else class="rp-dash">—</span>
              </td>
              <td>
                <span v-if="row.position" class="rp-pos-chip mono">
                  {{ positionText(row.position) }}
                </span>
                <span v-else class="rp-dash">—</span>
              </td>
              <td class="text-right">
                <span class="num">{{ fmtMetric(row.height) }}<span v-if="row.height!=null" class="rp-unit">cm</span>
                  <span class="rp-slash"> / </span>
                  {{ fmtMetric(row.weight) }}<span v-if="row.weight!=null" class="rp-unit">kg</span>
                </span>
              </td>
              <td class="text-right">
                <span v-if="row.bodyFatRate != null" class="num">{{ fmtMetric(row.bodyFatRate) }}<span class="rp-unit">%</span></span>
                <span v-else class="rp-dash">—</span>
              </td>
              <td>
                <span class="rp-status-badge" :class="'tone-' + rtpMeta(row).tone">
                  <span class="rp-status-dot-wrap">
                    <span v-if="row.rtpStatus === 'r'" class="rp-status-ping"></span>
                    <span class="rp-status-dot"></span>
                  </span>
                  {{ rtpMeta(row).label }}
                </span>
              </td>
              <td>
                <div class="rp-actions">
                  <button type="button" class="rp-link" @click.stop="handleDetail(row)">查看档案 →</button>
                  <div class="rp-menu" @click.stop>
                    <button type="button" class="rp-menu-btn" @click="toggleMenu(row.athleteId)" aria-label="更多操作">
                      <el-icon><MoreFilled /></el-icon>
                    </button>
                    <div v-if="openMenuId === row.athleteId" class="rp-menu-pop">
                      <button
                        type="button"
                        class="rp-menu-item"
                        @click="onMenuEdit(row)"
                        v-hasPermi="['apms:athlete:edit']"
                      >编辑档案</button>
                      <button
                        type="button"
                        class="rp-menu-item is-danger"
                        @click="onMenuLeave(row)"
                        v-hasPermi="['apms:athlete:remove']"
                      >队员离队</button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="!loading && athleteList.length === 0" class="rp-empty">
          <p class="rp-empty-title">没有匹配的运动员</p>
          <p class="rp-empty-desc">请调整筛选条件或搜索关键词</p>
        </div>
      </div>

      <!-- ===== 分页（服务端分页，外观对齐 demo） ===== -->
      <div class="rp-pager">
        <span class="rp-pager-info">
          共 <b class="mono">{{ total }}</b> 人 · 每页 <span class="mono">{{ pageSize }}</span> 条
        </span>
        <div class="rp-pager-btns">
          <button type="button" class="rp-page-btn" :disabled="queryParams.pageNum <= 1" @click="goPage(queryParams.pageNum - 1)">
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <button
            v-for="p in pageNumbers"
            :key="p"
            type="button"
            class="rp-page-btn mono"
            :class="{ 'is-active': p === queryParams.pageNum }"
            @click="goPage(p)"
          >{{ p }}</button>
          <button type="button" class="rp-page-btn" :disabled="queryParams.pageNum >= totalPages" @click="goPage(queryParams.pageNum + 1)">
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- 新增/修改对话框（沿用原有表单） -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-form ref="athleteRef" :model="form" :rules="rules" label-width="90px">
        <el-row>
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" placeholder="请输入姓名" maxlength="50"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="球衣号" prop="jerseyNo">
              <el-input v-model="form.jerseyNo" placeholder="如 10" maxlength="8"/>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="性别" prop="gender">
              <el-radio-group v-model="form.gender">
                <el-radio value="M">男</el-radio>
                <el-radio value="F">女</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="出生日期" prop="birthday">
              <el-date-picker v-model="form.birthday" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%"/>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="主属队伍" prop="primaryTeamId">
              <el-select
                v-model="form.primaryTeamId"
                :placeholder="form.status === '0' ? '请选择队伍' : '离队/退役后无所属队伍'"
                :disabled="form.status !== '0'"
                style="width: 100%"
              >
                <el-option v-for="t in teamOptions" :key="t.deptId" :label="t.deptName" :value="t.deptId"/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="场上位置" prop="position">
              <el-select v-model="form.position" placeholder="请选择位置" clearable style="width: 100%">
                <el-option v-for="d in positionOptions" :key="d.value" :label="d.label" :value="d.value"/>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="form.phone" placeholder="可选" maxlength="20"/>
        </el-form-item>
        <el-form-item label="状态" prop="status" v-if="form.athleteId">
          <el-radio-group v-model="form.status" @change="onStatusChange">
            <el-radio v-for="d in statusOptions" :key="d.value" :value="d.value">{{ d.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- ========== 赛季整队晋升 ========== -->
    <el-dialog title="赛季整队晋升" v-model="promotion.open" width="860px" append-to-body @closed="resetPromotion">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:12px">
        <template #title>
          按部门名识别 U 档梯队（如 U16 梯队）；仅 cut-off 日当天超龄的队员晋升到同机构上一档，
          历史测试成绩与评级<span style="font-weight:600">不会重算</span>。
        </template>
      </el-alert>

      <div class="rp-promotion-bar">
        <span class="rpf-label">赛季 cut-off 日期</span>
        <el-date-picker
          v-model="promotion.cutoffDate"
          type="date"
          value-format="YYYY-MM-DD"
          :clearable="false"
          :disabled="promotion.loading || promotion.executing"
          placeholder="默认下一个 1 月 1 日"
          style="width:180px"
          @change="loadPromotionPreview"
        />
        <el-icon v-if="promotion.loading" class="is-loading" style="color:#94a3b8"><Loading/></el-icon>
        <span v-if="promotion.plan" class="rp-promotion-hint">
          已识别 {{ promotion.plan.teams.length }} 支 U 档梯队：{{ promotionTeamNames }}
        </span>
      </div>

      <el-alert
        v-for="(err, i) in (promotion.plan?.configErrors || [])"
        :key="'e' + i"
        type="error"
        :closable="false"
        show-icon
        :title="err"
        style="margin-bottom:8px"
      />

      <template v-if="promotion.plan">
        <div class="rp-promotion-stats">
          <span class="rp-prom-stat is-promote">晋升 {{ promotion.plan.promoteCount }} 人</span>
          <span class="rp-prom-stat">未超龄留队 {{ promotion.plan.stayYoungCount }} 人</span>
          <span class="rp-prom-stat is-overage">超龄无上级 {{ promotion.plan.stayOverAgeCount }} 人</span>
          <span class="rp-prom-stat">生日缺失 {{ promotion.plan.noBirthdayCount }} 人</span>
          <span v-if="promotion.plan.invalidTeamCount" class="rp-prom-stat is-invalid">
            归属无效 {{ promotion.plan.invalidTeamCount }} 人
          </span>
        </div>

        <el-table :data="promotionRows" size="small" height="380" border style="width:100%">
          <el-table-column label="处置" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.action === 'PROMOTE'" type="success" size="small">晋升</el-tag>
              <el-tag v-else-if="row.action === 'STAY_YOUNG'" type="info" size="small">留队</el-tag>
              <el-tag v-else-if="row.action === 'STAY_OVERAGE'" type="warning" size="small">超龄留队</el-tag>
              <el-tag v-else-if="row.action === 'INVALID_TEAM'" type="danger" size="small">归属无效</el-tag>
              <el-tag v-else type="danger" size="small">生日缺失</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="姓名" width="90"/>
          <el-table-column label="cut-off 年龄" width="100">
            <template #default="{ row }">{{ row.ageAtCutoff == null ? '—' : row.ageAtCutoff + ' 岁' }}</template>
          </el-table-column>
          <el-table-column label="现梯队" width="150">
            <template #default="{ row }">
              <span v-if="row.fromTeamName">{{ row.fromTeamName }}</span>
              <span v-else style="color:#dc2626">部门#{{ row.fromTeamId }}（已失效）</span>
            </template>
          </el-table-column>
          <el-table-column label="晋升至" width="130">
            <template #default="{ row }">
              <span v-if="row.toTeamName" style="color:#16a34a;font-weight:600">{{ row.toTeamName }}</span>
              <span v-else style="color:#94a3b8">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="说明" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ row.reason }}</span>
              <el-tooltip v-if="row.jerseyConflict" content="晋升后球衣号与目标队现有成员重复，请赛后调整" placement="top">
                <el-tag type="warning" size="small" style="margin-left:6px">球衣号冲突</el-tag>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <template #footer>
        <el-button @click="promotion.open = false">关 闭</el-button>
        <el-button
          type="primary"
          :loading="promotion.executing"
          :disabled="!canExecutePromotion"
          @click="handleExecutePromotion"
        >确认执行晋升（{{ promotion.plan?.promoteCount || 0 }} 人）</el-button>
      </template>
    </el-dialog>

    <!-- ========== 运动员详情抽屉（整行点击/查看档案，不切换路由） ========== -->
    <AthleteDetailDrawer
      v-model="detailOpen"
      :athlete-id="detailAthleteId"
      @changed="handleDetailChanged"
    />
    </read-only-block>
  </div>
</template>

<script setup name="Athlete">
import { listAthlete, rtpSummaryAthlete, getAthlete, addAthlete, updateAthlete, delAthlete,
         previewPromotion, executePromotion } from '@/api/apms/athlete'
import { listDept } from '@/api/system/dept'
import GenderBadge from '@/components/GenderBadge/index.vue'
import AthleteDetailDrawer from './components/AthleteDetailDrawer.vue'
import ReadOnlyBlock from '@/components/ReadOnlyBlock/index.vue'
import { ageAvatarColor } from '@/utils/athleteAvatar'
import { useDict } from '@/utils/dict'
import { Plus, Search, RefreshLeft, MoreFilled, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const { proxy } = getCurrentInstance()
const { apms_position, apms_athlete_status } = useDict('apms_position', 'apms_athlete_status')

/* ===== demo 花名册视觉常量（与 demo tailwind token 对齐） ===== */
// 年龄段内部值为纯数字（与后端 ageGroups 参数一致），展示时统一拼「岁」，避免与 U16 梯队混淆
const AGE_GROUPS = [13, 14, 15, 16, 17, 18]
const STATUS_CHIPS = [
  { key: '', label: '全部', dot: '' },
  { key: 'g', label: '绿', dot: '#16A34A' },
  { key: 'y', label: '黄', dot: '#D97706' },
  { key: 'r', label: '红', dot: '#DC2626' }
]
const RTP_META = {
  g: { tone: 'green', label: '可参训' },
  y: { tone: 'amber', label: '限制参训' },
  r: { tone: 'red', label: '停训' }
}

const athleteList = ref([])
const loading = ref(true)
const open = ref(false)
const title = ref('')
const ids = ref([])
const total = ref(0)
const pageSize = 12
const teamOptions = ref([])
const openMenuId = ref(null)
const rtpCounts = reactive({ g: 0, y: 0, r: 0 })

const positionOptions = computed(() => apms_position.value || [])
const statusOptions = computed(() => apms_athlete_status.value || [])

const filters = reactive({
  name: '',
  primaryTeamId: '',
  gender: '',
  position: '',
  rtpStatus: '',
  groups: []
})

const data = reactive({
  queryParams: { pageNum: 1, pageSize },
  form: {},
  rules: {
    name: [{ required: true, message: '姓名不能为空', trigger: 'blur' }],
    gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
    primaryTeamId: [{
      // 仅在队状态要求选择主属队伍；离队/退役与队伍无归属关系
      validator: (rule, value, callback) => {
        if (form.value.status === '0' && (value === '' || value == null)) {
          callback(new Error('请选择主属队伍'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }]
  }
})
const { queryParams, form, rules } = toRefs(data)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

/** 分页页码窗口（总数多时只显示当前页附近的页码） */
const pageNumbers = computed(() => {
  const pages = totalPages.value
  const cur = queryParams.value.pageNum
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const start = Math.max(2, Math.min(pages - 4, cur - 2))
  const nums = [1]
  if (start > 2) nums.push('…')
  for (let p = start; p < start + 4 && p < pages; p++) nums.push(p)
  if (start + 3 < pages - 1) nums.push('…')
  nums.push(pages)
  return nums
})

/* ===== 展示辅助 ===== */
// 年龄段推导：与后端 SQL 同口径（age+1 收敛到 13~18），返回纯数字
function ageGroup(row) {
  if (row.age == null) return null
  return Math.min(18, Math.max(13, row.age + 1))
}
function groupColor(row) {
  return ageAvatarColor(row.age)
}
function ageBadgeStyle(row) {
  const c = groupColor(row)
  return { color: c, borderColor: c + '55', background: c + '0F' }
}
function rtpMeta(row) {
  return RTP_META[row.rtpStatus] || { tone: 'gray', label: '未评估' }
}
// 位置展示：标准字典码显示「MF · 中场」；兼容存量数据里直接存中文标签的情况
function positionText(val) {
  const byCode = positionOptions.value.find(d => d.value === val)
  if (byCode) return byCode.value + ' · ' + byCode.label
  const byLabel = positionOptions.value.find(d => d.label === val)
  if (byLabel) return byLabel.value + ' · ' + byLabel.label
  return val
}
function fmtMetric(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return String(parseFloat(n.toFixed(1)))
}

/* ===== 查询 ===== */
function buildParams() {
  return {
    ...queryParams.value,
    name: filters.name.trim() || undefined,
    primaryTeamId: filters.primaryTeamId || undefined,
    gender: filters.gender || undefined,
    position: filters.position || undefined,
    rtpStatus: filters.rtpStatus || undefined,
    ageGroups: filters.groups
  }
}

function getList() {
  loading.value = true
  listAthlete(buildParams()).then(res => {
    athleteList.value = res.rows
    total.value = res.total
    // 当前页删除/离队后可能落在空页，自动回退一页
    if (!res.rows.length && queryParams.value.pageNum > 1) {
      queryParams.value.pageNum -= 1
      getList()
      return
    }
  }).finally(() => {
    loading.value = false
  })
}

function getSummary() {
  rtpSummaryAthlete(buildParams()).then(res => {
    rtpCounts.g = 0; rtpCounts.y = 0; rtpCounts.r = 0
    ;(res.data || []).forEach(r => {
      if (r.status === 'g' || r.status === 'y' || r.status === 'r') {
        rtpCounts[r.status] = Number(r.cnt) || 0
      }
    })
  })
}

function reload() {
  ids.value = []
  openMenuId.value = null
  getList()
  getSummary()
}

function countOf(key) {
  if (key === '') return total.value
  return rtpCounts[key] || 0
}

// 筛选变化：回第一页并防抖触发
let filterTimer = null
watch(filters, () => {
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => {
    queryParams.value.pageNum = 1
    reload()
  }, 250), { deep: true }
})

function toggleGroup(g) {
  const i = filters.groups.indexOf(g)
  if (i >= 0) filters.groups.splice(i, 1)
  else filters.groups.push(g)
}
function resetFilters() {
  filters.name = ''
  filters.primaryTeamId = ''
  filters.gender = ''
  filters.position = ''
  filters.rtpStatus = ''
  filters.groups = []
}
function goPage(p) {
  if (p === '…' || p < 1 || p > totalPages.value || p === queryParams.value.pageNum) return
  queryParams.value.pageNum = p
  reload()
}

/* ===== 多选（仅保留批量离队） ===== */
function toggleRow(row) {
  const i = ids.value.indexOf(row.athleteId)
  if (i >= 0) ids.value.splice(i, 1)
  else ids.value.push(row.athleteId)
}

/* ===== 行内操作菜单（点击外部关闭） ===== */
function onDocClick() {
  openMenuId.value = null
}
function toggleMenu(id) {
  if (openMenuId.value === id) {
    openMenuId.value = null
    document.removeEventListener('click', onDocClick)
  } else {
    openMenuId.value = id
    document.addEventListener('click', onDocClick)
  }
}
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function onMenuEdit(row) {
  openMenuId.value = null
  handleUpdate(row)
}
function onMenuLeave(row) {
  openMenuId.value = null
  handleDelete(row)
}

/* ===== 队伍字典 ===== */
function getTeamOptions() {
  listDept({ status: '0' }).then(res => {
    teamOptions.value = (res.data || []).filter(d => d.deptType === '20' || d.deptType === 20)
  })
}

/* ===== 新增 / 修改 ===== */
function handleAdd() {
  reset()
  open.value = true
  title.value = '新建运动员档案'
}
function handleUpdate(row) {
  reset()
  getAthlete(row.athleteId).then(res => {
    form.value = res.data
    open.value = true
    title.value = '编辑运动员档案'
  })
}
/* 状态切换：离队/退役后与队伍无归属，清空主属队伍；后端保存时会同步关闭在组记录 */
function onStatusChange(val) {
  if (val !== '0') form.value.primaryTeamId = undefined
}

function submitForm() {
  proxy.$refs['athleteRef'].validate(valid => {
    if (!valid) return
    if (form.value.athleteId) {
      updateAthlete(form.value).then(() => {
        proxy.$modal.msgSuccess('修改成功')
        open.value = false
        getList()
      })
    } else {
      addAthlete(form.value).then(() => {
        proxy.$modal.msgSuccess('新增成功')
        open.value = false
        getList()
        getSummary()
      })
    }
  })
}
function cancel() {
  open.value = false
  reset()
}
function reset() {
  form.value = {
    athleteId: undefined,
    name: undefined,
    gender: 'M',
    birthday: undefined,
    phone: undefined,
    primaryTeamId: undefined,
    jerseyNo: undefined,
    position: undefined,
    status: '0'
  }
  proxy.resetForm('athleteRef')
}

/* ===== 离队（逻辑删除，单个/批量） ===== */
function handleDelete(row) {
  const athleteIds = row && row.athleteId ? [row.athleteId] : ids.value
  proxy.$modal.confirm('确认将选中的 ' + athleteIds.length + ' 名队员设为离队状态？').then(() => {
    return delAthlete(athleteIds.join(','))
  }).then(() => {
    reload()
    proxy.$modal.msgSuccess('已设为离队')
  }).catch(() => {})
}

/* ===== 详情（整行点击）：右侧抽屉，不切换 location ===== */
const detailOpen = ref(false)
const detailAthleteId = ref(null)
function handleDetail(row) {
  detailAthleteId.value = row.athleteId
  detailOpen.value = true
}
// 抽屉内数据变更（RTP/体态/小组等）后同步列表行徽章与统计
function handleDetailChanged() {
  getList()
  getSummary()
}

// 初始化
getTeamOptions()
getList()
getSummary()

/* ===== 赛季整队晋升 ===== */
function nextJanFirst() {
  const now = new Date()
  const y = now.getMonth() > 0 || (now.getMonth() === 0 && now.getDate() > 1) ? now.getFullYear() + 1 : now.getFullYear()
  return y + '-01-01'
}
const promotion = reactive({
  open: false,
  cutoffDate: nextJanFirst(),
  loading: false,
  executing: false,
  plan: null
})
// 表格优先展示晋升/超龄人员，便于核对
const promotionRows = computed(() => {
  const items = promotion.plan?.items || []
  const rank = { PROMOTE: 0, STAY_OVERAGE: 1, INVALID_TEAM: 2, NO_BIRTHDAY: 3, STAY_YOUNG: 4 }
  return [...items].sort((a, b) => (rank[a.action] ?? 9) - (rank[b.action] ?? 9))
})
// 识别到的梯队名（按上级部门、档位排序，便于看出晋升链）
const promotionTeamNames = computed(() => {
  const teams = [...(promotion.plan?.teams || [])]
    .sort((a, b) => (a.parentId - b.parentId) || (a.bracket - b.bracket))
    .map(t => t.deptName)
  return teams.join('、')
})
const canExecutePromotion = computed(() =>
  promotion.plan &&
  !(promotion.plan.configErrors && promotion.plan.configErrors.length) &&
  promotion.plan.promoteCount > 0 &&
  !promotion.loading && !promotion.executing
)

function openPromotionDialog() {
  promotion.open = true
  loadPromotionPreview()
}

function loadPromotionPreview() {
  promotion.loading = true
  promotion.plan = null
  previewPromotion({ cutoffDate: promotion.cutoffDate || null }).then(res => {
    promotion.plan = res.data
  }).finally(() => { promotion.loading = false })
}

function handleExecutePromotion() {
  const n = promotion.plan.promoteCount
  const overage = promotion.plan.stayOverAgeCount
  const invalid = promotion.plan.invalidTeamCount
  const conflict = promotion.plan.items.filter(i => i.action === 'PROMOTE' && i.jerseyConflict).length
  let msg = '确认按 cut-off ' + promotion.plan.cutoffDate + ' 晋升 ' + n + ' 名队员？'
  msg += '\n仅调整队员所属梯队，历史成绩与评级不变。'
  if (overage) msg += '\n另有 ' + overage + ' 名超龄队员因无更高档梯队留队。'
  if (invalid) msg += '\n另有 ' + invalid + ' 名队员所属部门非 U 档梯队/已失效，本次不动。'
  if (conflict) msg += '\n注意：' + conflict + ' 人晋升后存在球衣号冲突（仅预警）。'
  proxy.$modal.confirm(msg).then(() => {
    promotion.executing = true
    return executePromotion({ cutoffDate: promotion.cutoffDate || null })
  }).then(res => {
    if (!res) return
    promotion.plan = res.data
    proxy.$modal.msgSuccess('晋升完成：' + res.data.promoteCount + ' 人，批次号 ' + res.data.batchNo)
    getList()
    getSummary()
  }).finally(() => { promotion.executing = false })
}

function resetPromotion() {
  promotion.plan = null
  promotion.cutoffDate = nextJanFirst()
}
</script>

<style lang="scss" scoped>
$brand-600: #2563eb;
$brand-700: #1d4ed8;
$brand-500: #3b82f6;
$brand-50: #eff5ff;
$text-1: #0f172a;
$text-2: #475569;
$text-3: #94a3b8;
$line: #e5e9f0;
$canvas: #f8faff;
$ok: #16a34a;
$warn: #d97706;
$risk: #dc2626;

.roster-page {
  font-size: 14px;
  color: $text-1;
}
.mono {
  font-family: var(--app-font-mono);
  font-variant-numeric: tabular-nums;
}

/* ===== 页头 ===== */
.rp-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}
.rp-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 30px;
  color: $text-1;
}
.rp-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: $text-2;
}
.rp-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
:deep(.rp-btn-primary.el-button) {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  // 无 1px 边框：否则渐变按 padding-box 定位+repeat 平铺却裁剪到 border-box，
  // 边框环会铺出相邻平铺色块（左青右蓝反色细线），与 demo border-width:0 对齐
  border: 0;
  background: linear-gradient(90deg, #2563eb, #06b6d4);
  box-shadow: 0 4px 12px rgba(37, 99, 235, .22);
  font-weight: 600;
  transition: background .15s, box-shadow .15s;
  &:hover, &:focus {
    background: linear-gradient(90deg, #3B82F6, #22D3EE);
    box-shadow: 0 6px 16px rgba(37, 99, 235, .28);
  }
}
:deep(.rp-btn-danger.el-button) {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-weight: 500;
}

/* ===== 筛选条 ===== */
.rp-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fff;
  border: 1px solid $line;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04), 0 1px 3px rgba(15, 23, 42, .06);
}
.rpf-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.rpf-label {
  margin-right: 4px;
  font-size: 12px;
  color: $text-3;
  white-space: nowrap;
}
.rpf-divider {
  width: 1px;
  height: 20px;
  background: $line;
}
.rpf-field {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.rp-select {
  height: 32px;
  padding: 0 8px;
  font-size: 13px;
  color: $text-1;
  background: #fff;
  border: 1px solid $line;
  border-radius: 10px;
  outline: none;
  transition: border-color .15s;
  &:focus { border-color: $brand-500; }
}
.rp-select-team { width: 150px; }
.rp-select-xs { width: 72px; }

.rp-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  border: 1px solid $line;
  border-radius: 999px;
  background: #fff;
  color: $text-2;
  cursor: pointer;
  transition: all .15s;
  user-select: none;
  &:active { transform: scale(.95); }
}
.rp-chip-group {
  font-family: var(--app-font-mono);
  font-weight: 500;
  &:hover { border-color: $brand-500; color: $brand-600; }
  &.is-active {
    border-color: $brand-600;
    background: $brand-600;
    color: #fff;
  }
}
.rp-chip-status {
  font-weight: 400;
  &:hover { border-color: $brand-500; }
  &.is-active {
    border-color: $brand-600;
    background: $brand-50;
    color: $brand-600;
    font-weight: 600;
  }
}
.rp-chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.rp-chip-count {
  font-family: var(--app-font-mono);
  font-size: 11px;
  color: $text-3;
}
.rpf-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.rp-search {
  position: relative;
}
.rp-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  color: $text-3;
  pointer-events: none;
}
.rp-search-input {
  width: 176px;
  height: 32px;
  padding: 0 12px 0 30px;
  font-size: 13px;
  color: $text-1;
  border: 1px solid $line;
  border-radius: 10px;
  outline: none;
  transition: border-color .15s;
  &::placeholder { color: $text-3; }
  &:focus { border-color: $brand-500; }
}
.rp-btn-reset {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  color: $text-2;
  background: #fff;
  border: 1px solid $line;
  border-radius: 10px;
  cursor: pointer;
  transition: background .15s;
  &:hover { background: $canvas; }
  &:active { transform: scale(.95); }
  .el-icon { font-size: 13px; }
}

/* ===== 表格卡片 ===== */
.rp-table-card {
  overflow: hidden;
  background: #fff;
  border: 1px solid $line;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04), 0 1px 3px rgba(15, 23, 42, .06);
}
.rp-table-scroll { overflow-x: auto; }
.rp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.rp-table thead th {
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 500;
  color: $text-3;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid $line;
  background: #fff;
}
.rp-table th.text-right,
.rp-table td.text-right { text-align: right; }
.rp-table .col-check {
  width: 40px;
  padding-left: 16px;
}
.rp-row {
  cursor: pointer;
  border-bottom: 1px solid $line;
  transition: background .12s;
  &:last-child td { border-bottom: none; }
  &.is-zebra { background: #fafbfd; }
  &:hover { background: $canvas; }
  /* 红/黄状态行：3px 左侧色条（inset shadow 不占布局） */
  &.row-red { box-shadow: inset 3px 0 0 $risk; }
  &.row-amber { box-shadow: inset 3px 0 0 $warn; }
}
.rp-table tbody td {
  padding: 10px 16px;
  vertical-align: middle;
}
.rp-check {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

/* 运动员单元格 */
.rp-user {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rp-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
.rp-user-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: $text-1;
  display: flex;
  align-items: center;
  gap: 5px;
}
.rp-user-sub {
  margin: 3px 0 0;
  font-size: 11px;
  color: $text-3;
}

/* 年龄组 pill */
.rp-age-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
  border-radius: 999px;
}

/* 位置 chip */
.rp-pos-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  color: $text-2;
  background: $canvas;
  border-radius: 8px;
}

.num {
  color: $text-1;
  font-variant-numeric: tabular-nums;
}
.rp-unit {
  margin-left: 2px;
  font-size: 11px;
  color: $text-3;
}
.rp-slash { color: $text-3; }
.rp-dash { color: $text-3; }

/* RTP 状态徽章（绿/黄/红/灰，红色脉冲） */
.rp-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 1px 8px;
  font-size: 12px;
  line-height: 18px;
  border: 1px solid;
  border-radius: 999px;
  white-space: nowrap;
  &.tone-green { background: #e8f7ee; border-color: #b7e4c7; color: $ok; .rp-status-dot { background: $ok; } }
  &.tone-amber { background: #fef3e0; border-color: #f5d9a8; color: $warn; .rp-status-dot { background: $warn; } }
  &.tone-red   { background: #fcebeb; border-color: #f3c1c1; color: $risk; .rp-status-dot { background: $risk; } }
  &.tone-gray  { background: #f1f5f9; border-color: #e2e8f0; color: #475569; .rp-status-dot { background: #94a3b8; } }
}
.rp-status-dot-wrap {
  position: relative;
  display: inline-flex;
  width: 6px;
  height: 6px;
}
.rp-status-dot {
  position: relative;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  z-index: 1;
}
.rp-status-ping {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: $risk;
  opacity: .6;
  animation: rp-ping 1.4s cubic-bezier(0, 0, .2, 1) infinite;
}
@keyframes rp-ping {
  0% { transform: scale(1); opacity: .6; }
  75%, 100% { transform: scale(2.4); opacity: 0; }
}

/* 操作列 */
.rp-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
.rp-link {
  padding: 4px 2px;
  font-size: 12px;
  font-weight: 500;
  color: $brand-600;
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  &:hover { color: $brand-700; }
}
.rp-menu { position: relative; }
.rp-menu-btn {
  display: inline-flex;
  padding: 6px;
  color: $text-3;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  &:hover { background: $canvas; color: $text-1; }
}
.rp-menu-pop {
  position: absolute;
  right: 0;
  top: 32px;
  z-index: 20;
  width: 128px;
  padding: 4px 0;
  background: #fff;
  border: 1px solid $line;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, .1);
}
.rp-menu-item {
  display: block;
  width: 100%;
  padding: 8px 14px;
  font-size: 13px;
  text-align: left;
  color: $text-2;
  background: none;
  border: none;
  cursor: pointer;
  &:hover { background: $canvas; color: $text-1; }
  &.is-danger { color: $risk; }
}

/* 空状态 */
.rp-empty {
  padding: 48px 0;
  text-align: center;
}
.rp-empty-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: $text-2;
}
.rp-empty-desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: $text-3;
}

/* 分页 */
.rp-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid $line;
}
.rp-pager-info {
  font-size: 12px;
  color: $text-3;
  b { color: $text-2; font-weight: 500; }
}
.rp-pager-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rp-page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  font-size: 12px;
  color: $text-2;
  background: #fff;
  border: 1px solid $line;
  border-radius: 10px;
  cursor: pointer;
  transition: background .15s, color .15s;
  &:hover:not(:disabled):not(.is-active) { background: $canvas; }
  &:disabled { opacity: .4; cursor: not-allowed; }
  &.is-active {
    color: #fff;
    font-weight: 600;
    background: $brand-600;
    border-color: $brand-600;
  }
}

/* 窄屏：右侧搜索区换行占整行 */
@media (max-width: 900px) {
  .rpf-right { margin-left: 0; width: 100%; }
  .rp-search-input { width: 100%; }
  .rp-search { flex: 1; }
}

/* 赛季晋升弹窗 */
.rp-promotion-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.rp-promotion-hint {
  font-size: 12px;
  color: #64748b;
}
.rp-promotion-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.rp-prom-stat {
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
}
.rp-prom-stat.is-promote {
  background: #dcfce7;
  color: #15803d;
  font-weight: 600;
}
.rp-prom-stat.is-overage {
  background: #fef3c7;
  color: #b45309;
}
.rp-prom-stat.is-invalid {
  background: #fee2e2;
  color: #b91c1c;
}
</style>
