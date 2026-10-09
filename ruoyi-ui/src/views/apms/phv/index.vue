<template>
  <div class="app-container" :class="{ 'is-embedded': embedded }">
    <div class="rk-dash-page rk-page pm-page">

      <!-- ===== 页头（合并页内也保留：统计信息 + 新增 PHV 计算入口） ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">PHV 成熟度</h1>
          <p class="rk-subtitle">{{ summary.total }} 条记录 · {{ summary.athletes }} 名队员 · Mirwald 模型预测</p>
        </div>
        <div class="rk-header-actions">
          <el-button type="primary" class="rk-btn rk-btn-primary" @click="showCalcDialog()"
                     v-hasPermi="['apms:phv:edit']">
            <el-icon><MagicStick /></el-icon>新增 PHV 计算
          </el-button>
        </div>
      </div>

      <!-- ===== KPI 卡带 ===== -->
      <div class="rk-kpi-grid is-4">
        <div class="rk-kpi-card" v-for="k in kpiCards" :key="k.label">
          <span class="rk-kpi-accent" :style="{ background: k.accent }"></span>
          <div class="rk-kpi-label">{{ k.label }}</div>
          <div class="rk-kpi-value">{{ k.value }}<span class="rk-kpi-unit" v-if="k.unit">{{ k.unit }}</span></div>
          <span class="rk-kpi-chip" :class="k.chipTone">{{ k.chip }}</span>
        </div>
      </div>

      <!-- ===== 筛选 ===== -->
      <div class="rk-filter pm-filter">
        <label class="rk-group">
          <span class="rk-label">队员</span>
          <input v-model="filters.keyword" class="rk-input" type="text" placeholder="队员姓名" />
        </label>
        <div class="rk-filter-right">
          <button type="button" class="rk-btn-reset" @click="resetFilter">
            <el-icon><RefreshLeft /></el-icon>重置
          </button>
        </div>
      </div>

      <!-- ===== PHV 记录表 ===== -->
      <div v-loading="loading" class="rk-table-card">
        <div class="rk-table-scroll">
          <table class="rk-table pm-table">
            <thead>
              <tr>
                <th class="text-center col-index">#</th>
                <th>队员</th>
                <th class="text-center col-date">测量日期</th>
                <th class="text-right col-height">身高(cm)</th>
                <th class="text-right col-sit">坐高(cm)</th>
                <th class="text-right col-age">年龄</th>
                <th class="text-center col-offset">成熟度偏移</th>
                <th class="text-center col-phv">预测 PHV 年龄</th>
                <th class="text-center col-adult">预测成年身高</th>
                <th class="text-center col-method">计算方法</th>
                <th class="col-time">计算时间</th>
                <th class="text-right col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in pagedData" :key="row.id" class="rk-row" :class="{ 'is-zebra': idx % 2 === 1 }">
                <td class="text-center rk-mono rk-dash">{{ (page - 1) * PAGE_SIZE + idx + 1 }}</td>
                <td>
                  <div class="rk-person">
                    <span class="rk-avatar pm-avatar" :style="{ background: avatarColor(row) }">
                      {{ (row.athleteName || '?').charAt(0) }}
                    </span>
                    <div class="rk-person-meta">
                      <span class="rk-person-main">
                        {{ row.athleteName || '—' }}
                        <GenderBadge :gender="row.gender" :size="15" class="pm-gender"/>
                      </span>
                      <span class="rk-person-sub">{{ row.athleteTeam || '无队伍' }} · #{{ row.athleteId }}</span>
                    </div>
                  </div>
                </td>
                <td class="text-center rk-mono">{{ row.measureDate || '—' }}</td>
                <td class="text-right rk-mono col-height">{{ row.height ?? '—' }}</td>
                <td class="text-right rk-mono col-sit">{{ row.sitHeight ?? '—' }}</td>
                <td class="text-right rk-mono">{{ row.decimalAge != null ? Number(row.decimalAge).toFixed(1) + ' 岁' : '—' }}</td>
                <td class="text-center col-offset">
                  <button v-if="row.maturityOffset != null" type="button" class="pm-offset-btn"
                          :title="'点击查看 Mirwald 计算过程'" @click="openFormula(row)">
                    <span class="rk-status-badge" :class="offsetMeta(row.maturityOffset).tone">
                      <i class="rk-status-dot"></i>{{ offsetText(row.maturityOffset) }}
                    </span>
                  </button>
                  <span v-else class="rk-dash">—</span>
                </td>
                <td class="text-center col-phv">
                  <button v-if="row.predictedPhvAge != null" type="button" class="pm-value-btn pm-phv-age"
                          title="点击查看预测 PHV 年龄由来" @click="openFormula(row)">
                    {{ Number(row.predictedPhvAge).toFixed(1) }}<small> 岁</small>
                  </button>
                  <span v-else class="rk-dash">—</span>
                </td>
                <td class="text-center col-adult">
                  <button v-if="adultHeightOf(row) != null" type="button" class="pm-value-btn pm-adult-h rk-mono"
                          title="点击查看预测成年身高由来" @click="openAdult(row)">
                    {{ adultHeightOf(row) }}<small> cm</small>
                  </button>
                  <span v-else class="rk-dash">—</span>
                </td>
                <td class="text-center col-method">
                  <span class="rk-soft-chip">{{ row.mirwaldVersion || 'Mirwald' }}</span>
                </td>
                <td class="rk-mono col-time pm-cell-time">{{ row.createTime || '—' }}</td>
                <td class="text-right">
                  <div class="rk-actions">
                    <button type="button" class="rk-link pm-link-danger"
                            @click="handleDelete(row)" v-hasPermi="['apms:phv:remove']">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="!loading && filteredData.length === 0" class="rk-empty">
            <p class="rk-empty-title">{{ filters.keyword ? '没有匹配的 PHV 记录' : '暂无 PHV 记录' }}</p>
            <p class="rk-empty-desc">{{ filters.keyword ? '请调整筛选条件后重试' : '点击右上角「新增 PHV 计算」生成第一条记录' }}</p>
          </div>
        </div>
        <RkPager v-if="!loading && filteredData.length > PAGE_SIZE" v-model:page="page" :total="filteredData.length" :page-size="PAGE_SIZE" unit="条"/>
      </div>

      <!-- ========= PHV 计算弹窗 ========= -->
      <el-dialog title="PHV 成熟度计算" v-model="showCalc" width="600px">
        <el-alert type="info" show-icon :closable="false" class="calc-tip">
          PHV（Peak Height Velocity）用 Mirwald 公式，输入身高、坐高、体重、年龄、父母身高，预测：成熟度偏移、PHV 年龄、成年身高。
        </el-alert>

        <el-form :model="calcForm" label-width="120px">
          <el-form-item label="计算方式" required>
            <el-radio-group v-model="calcMode">
              <el-radio value="fromMeasure">从体态测量记录计算</el-radio>
              <el-radio value="direct">手动输入参数计算</el-radio>
            </el-radio-group>
          </el-form-item>

          <!-- 从体态测量 -->
          <template v-if="calcMode === 'fromMeasure'">
            <el-form-item label="运动员" required>
              <el-select v-model="calcForm.athleteId" filterable placeholder="选择队员"
                         style="width:100%" @change="onCalcAthleteChange">
                <el-option v-for="a in athleteOpts" :key="a.athleteId"
                           :label="`${a.name} (${a.primaryTeamName || '—'})`"
                           :value="a.athleteId"/>
              </el-select>
            </el-form-item>
            <el-form-item label="体态测量记录" required v-if="calcForm.athleteId">
              <el-select v-model="calcForm.sourceMeasureId" placeholder="选一条测量记录"
                         style="width:100%" @change="fillFromMeasure">
                <el-option v-for="m in currentAthleteMeasures" :key="m.id"
                           :label="`${m.measureDate} · 身高${m.height}cm · 体重${m.weight}kg`"
                           :value="m.id"/>
              </el-select>
            </el-form-item>
          </template>

          <!-- 手动输入 -->
          <template v-if="calcMode === 'direct'">
            <el-form-item label="运动员" required>
              <el-select v-model="calcForm.athleteId" filterable placeholder="选择队员"
                         style="width:100%" @change="onCalcAthleteChange">
                <el-option v-for="a in athleteOpts" :key="a.athleteId"
                           :label="`${a.name} (${a.primaryTeamName || '—'})`"
                           :value="a.athleteId"/>
              </el-select>
            </el-form-item>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="测量日期" required>
                  <el-date-picker v-model="calcForm.measureDate" type="date" value-format="YYYY-MM-DD"
                                  style="width:100%"/>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="精确年龄(岁)">
                  <el-input-number v-model="calcForm.decimalAge" :precision="2" :min="8" :max="25"/>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="身高(cm)" required>
                  <el-input-number v-model="calcForm.height" :precision="1" :min="100" :max="230"/>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="坐高(cm)" required>
                  <el-input-number v-model="calcForm.sitHeight" :precision="1" :min="40" :max="150"/>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="体重(kg)">
                  <el-input-number v-model="calcForm.weight" :precision="1" :min="30" :max="150"/>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="父亲身高(cm)">
                  <el-input-number v-model="calcForm.fatherHeight" :precision="1" :min="140" :max="220"/>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="母亲身高(cm)">
                  <el-input-number v-model="calcForm.motherHeight" :precision="1" :min="140" :max="220"/>
                </el-form-item>
              </el-col>
            </el-row>
          </template>
        </el-form>

        <template #footer>
          <el-button @click="showCalc = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submitCalc">执行计算</el-button>
        </template>
      </el-dialog>

      <!-- ========= Mirwald 公式推导弹窗 ========= -->
      <el-dialog title="成熟度偏移计算过程 · Mirwald 2014.1" v-model="showFormula" width="720px" append-to-body>
        <div v-if="formula" class="mf-body">
          <el-alert v-if="!formula.versionMatch" type="warning" :closable="false" show-icon>
            <template #title>
              该记录由旧版算法（{{ formula.row.mirwaldVersion }}）计算。下表为使用相同输入按当前
              <b>Mirwald 2014.1</b> 的重新推导（参考值）；记录中的保存值仍为旧版结果，二者可能不同。
            </template>
          </el-alert>
          <div class="mf-head">
            <span class="mf-name">{{ formula.row.athleteName }}</span>
            <span class="rk-soft-chip">{{ formula.row.measureDate }}</span>
            <span class="rk-soft-chip">{{ formula.male ? '男性公式' : '女性公式' }}</span>
            <span class="rk-soft-chip">v{{ formula.row.mirwaldVersion || '2014.1' }}</span>
          </div>

          <!-- 输入参数 -->
          <div class="mf-section-title">输入参数</div>
          <div class="mf-inputs">
            <div class="mf-input"><label>精确年龄 A</label><b>{{ formula.fmt(formula.A, 4) }}</b><i>岁</i></div>
            <div class="mf-input"><label>站立身高 H</label><b>{{ formula.fmt(formula.H, 1) }}</b><i>cm</i></div>
            <div class="mf-input"><label>坐高 S</label><b>{{ formula.fmt(formula.S, 1) }}</b><i>cm</i></div>
            <div class="mf-input"><label>体重 W</label><b>{{ formula.fmt(formula.W, 1) }}</b><i>kg</i></div>
            <div class="mf-input"><label>腿长 L = H − S</label><b>{{ formula.fmt(formula.L, 1) }}</b><i>cm</i></div>
          </div>

          <!-- 公式 -->
          <div class="mf-section-title">公式（单位：岁）</div>
          <pre class="mf-formula">{{ formula.male
            ? '成熟度偏移 = −9.236\n           + 0.0002708 × (L × S)\n           − 0.001663 × (A × L)\n           + 0.007216 × (A × S)\n           + 0.02292  × (W ÷ H × 100)'
            : '成熟度偏移 = −9.376\n           + 0.0001882 × (L × S)\n           + 0.0022   × (A × L)\n           + 0.005841 × (A × S)\n           − 0.002658 × (A × W)\n           + 0.07693  × (W ÷ H × 100)' }}</pre>

          <!-- 逐项代入 -->
          <div class="mf-section-title">逐项代入</div>
          <table class="mf-table">
            <thead><tr><th>项目</th><th>代入计算</th><th class="text-right">结果(岁)</th></tr></thead>
            <tbody>
              <tr v-for="(t, i) in formula.terms" :key="i">
                <td>{{ t.label }}</td>
                <td class="rk-mono">{{ t.expr }}</td>
                <td class="text-right rk-mono">{{ t.signed }}</td>
              </tr>
              <tr class="mf-sum-row">
                <td colspan="2">
                  合计 = 成熟度偏移（Mirwald 2014.1，保留 4 位小数）
                  <span v-if="!formula.versionMatch" class="mf-old-saved">
                    ｜记录保存值（{{ formula.row.mirwaldVersion }}）：<b>{{ formula.fmt(formula.savedOffset, 4) }}</b>
                  </span>
                </td>
                <td class="text-right rk-mono"><b>{{ formula.fmt(formula.computedOffset, 4) }}</b></td>
              </tr>
            </tbody>
          </table>

          <!-- 结论 -->
          <div class="mf-result">
            <div class="mf-result-item">
              <span>
                预测 PHV 年龄 = A − 成熟度偏移 = {{ formula.fmt(formula.A, 4) }} − ({{ formula.fmt(formula.versionMatch ? formula.savedOffset : formula.computedOffset, 4) }})
                <span v-if="!formula.versionMatch" class="mf-old-saved">
                  ｜记录保存值：<b>{{ formula.fmt(formula.savedPhvAge, 2) }} 岁</b>
                </span>
              </span>
              <b class="pm-phv-age">{{ formula.fmt(formula.versionMatch ? formula.savedPhvAge : formula.computedPhvAge, 2) }}<small> 岁</small></b>
            </div>
            <div class="mf-note">
              成熟度偏移 &lt; 0：尚未到达身高突增高峰（PHV）；= 0 附近：峰值期前后；&gt; 0：已越过 PHV。
              各项按完整精度求和后末位四舍五入；结果用于成长跟踪与训练分组参考，不作为医学诊断。
            </div>
          </div>
        </div>
        <template #footer>
          <el-button type="primary" @click="showFormula = false">关 闭</el-button>
        </template>
      </el-dialog>

      <!-- ========= Khamis-Roche 成年身高推导窗 ========= -->
      <el-dialog title="预测成年身高计算过程 · Khamis-Roche" v-model="showAdult" width="720px" append-to-body>
        <div v-loading="adultLoading" v-if="adult" class="mf-body">
          <div class="mf-head">
            <span class="mf-name">{{ adult.athleteName }}</span>
            <span class="rk-soft-chip">{{ adult.male ? '男性公式' : '女性公式' }}</span>
            <span class="rk-soft-chip">{{ adult.version || 'khamis-roche-v1' }}</span>
            <span class="rk-soft-chip">更新于 {{ String(adult.calcDate || '').substring(0, 16) }}</span>
          </div>

          <el-alert type="info" :closable="false" show-icon>
            <template #title>
              该值保存在运动员档案中，每次体态测量保存后按<b>当时最新一条体态测量</b>的身高、体重自动重算，
              年龄取计算日的日历年龄。
            </template>
          </el-alert>

          <template v-if="adult.terms.length">
            <!-- 输入参数 -->
            <div class="mf-section-title">计算输入（{{ adult.sourceMeasureDate }} 的体态测量）</div>
            <div class="mf-inputs">
              <div class="mf-input"><label>日历年龄 A</label><b>{{ adult.fmt(adult.A, 2) }}</b><i>岁</i></div>
              <div class="mf-input"><label>当前身高 H</label><b>{{ adult.fmt(adult.H, 1) }}</b><i>cm</i></div>
              <div class="mf-input"><label>当前体重 W</label><b>{{ adult.fmt(adult.W, 1) }}</b><i>kg</i></div>
            </div>

            <div class="mf-section-title">公式（单位：cm）</div>
            <pre class="mf-formula">{{ adult.male
              ? 'H成年 = −3.32 + 1.04×H + 0.03×W + 0.45×A − 0.04×A²'
              : 'H成年 = 3.50 + 1.02×H + 0.03×W + 0.10×A − 0.03×A² + 0.001×A³' }}</pre>

            <div class="mf-section-title">逐项代入</div>
            <table class="mf-table">
              <thead><tr><th>项目</th><th>代入计算</th><th class="text-right">结果(cm)</th></tr></thead>
              <tbody>
                <tr v-for="(t, i) in adult.terms" :key="i">
                  <td>{{ t.label }}</td>
                  <td class="rk-mono">{{ t.expr }}</td>
                  <td class="text-right rk-mono">{{ t.signed }}</td>
                </tr>
                <tr class="mf-sum-row">
                  <td colspan="2">合计 = 预测成年身高（保留 1 位小数）</td>
                  <td class="text-right rk-mono"><b>{{ adult.fmt(adult.computedHeight, 1) }}</b></td>
                </tr>
              </tbody>
            </table>

            <div class="mf-result">
              <div class="mf-result-item">
                <span>
                  档案保存值
                  <span v-if="!adult.match" class="mf-old-saved">
                    ｜与按现有数据重算值（{{ adult.fmt(adult.computedHeight, 1) }} cm）存在差异，
                    可能因档案年龄或测量数据后续被修改
                  </span>
                </span>
                <b class="pm-adult-h">{{ adult.fmt(adult.savedHeight, 1) }}<small> cm</small></b>
              </div>
              <div class="mf-note">
                简化版 Khamis-Roche 无需骨龄/父母身高，RMSE 约 3.2cm，适合日常训练场景；
                预测值随测量更新逐步收敛，仅作成长跟踪与选材辅助参考，不作为医学诊断。
              </div>
            </div>
          </template>
          <el-alert v-else type="warning" :closable="false" show-icon
                    title="无法复现当时的计算输入（缺少生日或关联体态测量），档案保存值为 {{ adult.savedHeight }} cm"/>
        </div>
        <template #footer>
          <el-button type="primary" @click="showAdult = false">关 闭</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup name="ApmsPhv">

// 嵌入模式：由合并页（dispatch/growth/comboDispatch）堆叠使用
defineProps({ embedded: { type: Boolean, default: false } })
import { list as listPhv, calculate, calculateDirect, delPhv, adultHeightDerivation } from '@/api/apms/phv'
import { listAthlete } from '@/api/apms/athlete'
import { listByAthlete as listMeasuresByAthlete } from '@/api/apms/bodyMeasure'
import { MagicStick, RefreshLeft } from '@element-plus/icons-vue'
import GenderBadge from '@/components/GenderBadge/index.vue'
import RkPager from '@/components/RkPager/index.vue'
import { ageAvatarColor } from '@/utils/athleteAvatar'

const { proxy } = getCurrentInstance()

const loading = ref(false)
const rawData = ref([])
const athleteOpts = ref([])
const currentAthleteMeasures = ref([])
const filters = reactive({ keyword: '' })

/* ===== 头像色板（同运动员同色，沿用原页按 athleteId 取色口径） ===== */
const avatarColor = (row) => ageAvatarColor(row.athleteAge)

/* ===== 成熟度偏移语义（沿用原页阈值：>0.5 早熟 / <-0.5 晚熟） ===== */
function offsetMeta(v) {
  if (v > 0.5) return { tone: 'tone-red', hint: '早熟倾向', chipTone: 'tone-risk' }
  if (v < -0.5) return { tone: 'tone-green', hint: '晚熟倾向', chipTone: 'tone-ok' }
  return { tone: 'tone-amber', hint: '峰值期前后', chipTone: 'tone-warn' }
}
const offsetText = (v) => (v > 0 ? '+' : '') + Number(v).toFixed(2)

/* 成年身高：取运动员档案的 Khamis-Roche 最新预测值（PHV 记录表该列恒为空） */
const adultHeightOf = (row) => row.athleteAdultHeight ?? row.predictedAdultHeight ?? null

/* ===== Mirwald 公式推导弹窗（系数与后端 MirwaldCalculator 完全一致） ===== */
const showFormula = ref(false)
const formula = ref(null)
const mfFmt = (v, n) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(n))
const signed4 = (v) => (v > 0 ? '+' : '') + mfFmt(v, 4)

function openFormula(row) {
  const male = !['F', '1', '女'].includes(String(row.gender || '').trim().toUpperCase())
  const A = Number(row.decimalAge), H = Number(row.height), S = Number(row.sitHeight), W = Number(row.weight)
  const L = H - S
  const ratio = W / H * 100
  const A4 = mfFmt(A, 4), H1 = mfFmt(H, 1), S1 = mfFmt(S, 1), W1 = mfFmt(W, 1), L1 = mfFmt(L, 1)

  const terms = male
    ? [
        { label: '常数项', expr: '—', val: -9.236 },
        { label: '腿长 × 坐高', expr: `0.0002708 × (${L1} × ${S1})`, val: 0.0002708 * L * S },
        { label: '年龄 × 腿长', expr: `−0.001663 × (${A4} × ${L1})`, val: -0.001663 * A * L },
        { label: '年龄 × 坐高', expr: `0.007216 × (${A4} × ${S1})`, val: 0.007216 * A * S },
        { label: '体重身高比', expr: `0.02292 × (${W1} ÷ ${H1} × 100)`, val: 0.02292 * ratio }
      ]
    : [
        { label: '常数项', expr: '—', val: -9.376 },
        { label: '腿长 × 坐高', expr: `0.0001882 × (${L1} × ${S1})`, val: 0.0001882 * L * S },
        { label: '年龄 × 腿长', expr: `0.0022 × (${A4} × ${L1})`, val: 0.0022 * A * L },
        { label: '年龄 × 坐高', expr: `0.005841 × (${A4} × ${S1})`, val: 0.005841 * A * S },
        { label: '年龄 × 体重', expr: `−0.002658 × (${A4} × ${W1})`, val: -0.002658 * A * W },
        { label: '体重身高比', expr: `0.07693 × (${W1} ÷ ${H1} × 100)`, val: 0.07693 * ratio }
      ]

  const round4 = (v) => Math.round((v + Number.EPSILON) * 10000) / 10000
  const computedOffset = round4(terms.reduce((sum, t) => sum + t.val, 0))

  formula.value = {
    row, male, A, H, S, W, L,
    terms: terms.map(t => ({ ...t, signed: signed4(t.val) })),
    versionMatch: (row.mirwaldVersion || '2014.1') === '2014.1',
    computedOffset,
    computedPhvAge: round4(A - computedOffset),
    savedOffset: Number(row.maturityOffset),
    savedPhvAge: Number(row.predictedPhvAge),
    fmt: mfFmt
  }
  showFormula.value = true
}

/* ===== Khamis-Roche 成年身高推导（系数与后端 KhamisRocheCalculator 一致） ===== */
const showAdult = ref(false)
const adultLoading = ref(false)
const adult = ref(null)
const krSigned = (v) => (v > 0 ? '+' : '') + mfFmt(v, 3)

async function openAdult(row) {
  adult.value = null
  showAdult.value = true
  adultLoading.value = true
  try {
    const res = await adultHeightDerivation(row.athleteId)
    const d = res.data || {}
    const male = ['m', '0', '男'].includes(String(d.gender || '').toLowerCase())
    const src = d.sourceMeasure
    const A = Number(d.decimalAge), H = src != null ? Number(src.height) : NaN, W = src != null ? Number(src.weight) : NaN
    let terms = []
    if (Number.isFinite(A) && Number.isFinite(H) && Number.isFinite(W)) {
      const A2 = mfFmt(A, 2)
      terms = male
        ? [
            { label: '常数项', expr: '—', val: -3.32 },
            { label: '身高项', expr: `1.04 × ${mfFmt(H, 1)}`, val: 1.04 * H },
            { label: '体重项', expr: `0.03 × ${mfFmt(W, 1)}`, val: 0.03 * W },
            { label: '年龄项', expr: `0.45 × ${A2}`, val: 0.45 * A },
            { label: '年龄平方项', expr: `−0.04 × ${A2}²`, val: -0.04 * A * A }
          ]
        : [
            { label: '常数项', expr: '—', val: 3.50 },
            { label: '身高项', expr: `1.02 × ${mfFmt(H, 1)}`, val: 1.02 * H },
            { label: '体重项', expr: `0.03 × ${mfFmt(W, 1)}`, val: 0.03 * W },
            { label: '年龄项', expr: `0.10 × ${A2}`, val: 0.10 * A },
            { label: '年龄平方项', expr: `−0.03 × ${A2}²`, val: -0.03 * A * A },
            { label: '年龄立方项', expr: `0.001 × ${A2}³`, val: 0.001 * A * A * A }
          ]
    }
    const computedHeight = Math.round((terms.reduce((s, t) => s + t.val, 0) + Number.EPSILON) * 10) / 10
    const savedHeight = d.savedHeight != null ? Number(d.savedHeight) : null
    adult.value = {
      ...d,
      male, A, H, W,
      sourceMeasureDate: src ? String(src.measureDate).substring(0, 10) : '',
      terms: terms.map(t => ({ ...t, signed: krSigned(t.val) })),
      computedHeight,
      savedHeight,
      match: savedHeight != null && Math.abs(computedHeight - savedHeight) < 0.051,
      fmt: mfFmt
    }
  } finally {
    adultLoading.value = false
  }
}

/* ===== 汇总（全部记录口径，与原页一致） ===== */
const summary = reactive({ total: 0, athletes: 0, avgPhvAge: '—', avgOffset: null })

function buildSummary(arr) {
  summary.total = arr.length
  summary.athletes = new Set(arr.map(r => r.athleteId)).size
  const validAges = arr.filter(r => r.predictedPhvAge != null).map(r => Number(r.predictedPhvAge))
  const avgAge = validAges.length ? validAges.reduce((a, b) => a + b, 0) / validAges.length : null
  summary.avgPhvAge = avgAge != null ? avgAge.toFixed(2) : '—'
  const offsets = arr.filter(r => r.maturityOffset != null).map(r => Number(r.maturityOffset))
  summary.avgOffset = offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : null
}

const kpiCards = computed(() => {
  const off = summary.avgOffset
  const meta = off != null ? offsetMeta(off) : { tone: '', hint: '—', chipTone: '' }
  return [
    { label: 'PHV 记录总数', value: summary.total, unit: '条', accent: '#8B5CF6',
      chip: summary.athletes + ' 名队员', chipTone: 'tone-info' },
    { label: '覆盖队员数', value: summary.athletes, unit: '人', accent: '#06B6D4',
      chip: '按 DataScope 隔离', chipTone: '' },
    { label: '平均预测 PHV 年龄', value: summary.avgPhvAge, unit: '岁', accent: '#2563EB',
      chip: 'Mirwald v2014.1', chipTone: '' },
    { label: '平均成熟度偏移', value: off != null ? offsetText(off) : '—', unit: off != null ? '岁' : '',
      accent: off > 0.5 ? '#DC2626' : off < -0.5 ? '#16A34A' : '#D97706',
      chip: meta.hint, chipTone: meta.chipTone }
  ]
})

/* ===== 列表加载 + 前端姓名筛选（全量返回后本地过滤），固定每页 10 条本地分页 ===== */
const PAGE_SIZE = 10
const page = ref(1)
const filteredData = computed(() => {
  const kw = filters.keyword.trim()
  if (!kw) return rawData.value
  return rawData.value.filter(r => (r.athleteName || '').includes(kw))
})
// 关键词筛选变化时回到第 1 页；删除等导致条数减少时防止页码越界
watch(() => filters.keyword, () => { page.value = 1 })
watch(filteredData, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  if (page.value > maxPage) page.value = maxPage
})
const pagedData = computed(() =>
  filteredData.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

function loadList() {
  loading.value = true
  listPhv({}).then(res => {
    rawData.value = res.data || []
    buildSummary(rawData.value)
  }).finally(() => { loading.value = false })
}
function resetFilter() { filters.keyword = '' }

listAthlete({ pageNum: 1, pageSize: 500 }).then(res => { athleteOpts.value = res.rows || [] })

// ========= 计算弹窗 =========
const showCalc = ref(false)
const saving = ref(false)
const calcMode = ref('fromMeasure')
const calcForm = reactive({ athleteId: null, sourceMeasureId: null, measureDate: null,
  height: null, sitHeight: null, weight: null, decimalAge: null,
  fatherHeight: null, motherHeight: null })

function showCalcDialog() {
  Object.assign(calcForm, { athleteId: null, sourceMeasureId: null, measureDate: null,
    height: null, sitHeight: null, weight: null, decimalAge: null,
    fatherHeight: null, motherHeight: null })
  currentAthleteMeasures.value = []
  showCalc.value = true
}

function onCalcAthleteChange(athleteId) {
  if (!athleteId) { currentAthleteMeasures.value = []; return }
  const athlete = athleteOpts.value.find(a => a.athleteId === athleteId)
  listMeasuresByAthlete(athleteId).then(res => {
    currentAthleteMeasures.value = res.data || []
    // 如果有父母身高，填入
    calcForm.fatherHeight = athlete?.fatherHeight ?? null
    calcForm.motherHeight = athlete?.motherHeight ?? null
    // 尝试算 decimalAge
    if (athlete?.birthDate) {
      const bd = new Date(athlete.birthDate)
      const now = new Date()
      const age = (now - bd) / (365.25 * 86400000)
      calcForm.decimalAge = Number(age.toFixed(4))
    }
  })
}

function fillFromMeasure(measureId) {
  const m = currentAthleteMeasures.value.find(x => x.id === measureId)
  if (m) {
    calcForm.height = m.height
    calcForm.sitHeight = m.sitHeight
    calcForm.weight = m.weight
    calcForm.measureDate = m.measureDate
  }
}

function submitCalc() {
  saving.value = true
  if (calcMode.value === 'fromMeasure') {
    if (!calcForm.athleteId || !calcForm.sourceMeasureId) {
      proxy.$modal.msgWarning('请选择运动员和体态测量记录'); saving.value = false; return
    }
    calculate({ athleteId: calcForm.athleteId, measureId: calcForm.sourceMeasureId })
      .then(res => handleCalcResult(res.data))
      .finally(() => saving.value = false)
  } else {
    if (!calcForm.athleteId || !calcForm.height || !calcForm.sitHeight) {
      proxy.$modal.msgWarning('运动员、身高、坐高必填'); saving.value = false; return
    }
    calculateDirect({ ...calcForm, athleteId: calcForm.athleteId, gender: athleteGender(calcForm.athleteId) })
      .then(res => handleCalcResult(res.data))
      .finally(() => saving.value = false)
  }
}

function athleteGender(id) {
  const a = athleteOpts.value.find(x => x.athleteId === id)
  return a?.gender === 'F' ? '1' : '0'
}

function handleCalcResult(record) {
  proxy.$modal.msgSuccess('PHV 计算已保存')
  showCalc.value = false
  loadList()
  // 如果后端返回了计算结果，弹一个预览
  if (record) {
    const details = []
    if (record.maturityOffset != null) details.push(`成熟度偏移: ${Number(record.maturityOffset).toFixed(2)}`)
    if (record.predictedPhvAge != null) details.push(`预测 PHV 年龄: ${Number(record.predictedPhvAge).toFixed(1)}岁`)
    if (record.predictedAdultHeight != null) details.push(`预测成年身高: ${record.predictedAdultHeight}cm`)
    if (details.length) proxy.$alert(details.join('<br/>'), '计算结果预览', { dangerouslyUseHTMLString: true })
  }
}

function handleDelete(row) {
  proxy.$modal.confirm(`确认删除这条 PHV 记录吗？`).then(() => {
    delPhv(row.id).then(() => { proxy.$modal.msgSuccess('已删除'); loadList() })
  }).catch(() => {})
}

loadList()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.pm-filter { margin-bottom: 14px; }
.pm-table .rk-person-main { display: inline-flex; align-items: center; gap: 6px; }

/* 数值单元格 */
.pm-avatar { width: 32px; height: 32px; font-size: 13px; }
.pm-phv-age {
  font-family: var(--app-font-mono);
  font-size: 14px;
  font-weight: 700;
  color: $rk-ok;
  small { font-size: 11px; font-weight: 500; color: $rk-text-3; }
}
.pm-adult-h {
  font-size: 13px;
  font-weight: 600;
  color: #7c3aed;
  small { font-size: 11px; font-weight: 500; color: $rk-text-3; }
}
.pm-cell-time { font-size: 12px; color: $rk-text-2; white-space: nowrap; }
.pm-link-danger { color: $rk-risk; &:hover { color: #b91c1c; } }

/* 列宽与密度 */
.pm-table .col-index { width: 44px; }
.pm-table .col-date { width: 96px; }
.pm-table .col-height,
.pm-table .col-sit,
.pm-table .col-age { width: 76px; }
.pm-table .col-offset { width: 104px; }
.pm-table .col-phv,
.pm-table .col-adult { width: 112px; }
.pm-table .col-method { width: 120px; }
.pm-table .col-time { width: 158px; }
.pm-table .col-actions { width: 72px; }
.pm-table :is(thead th, tbody td) { padding-left: 12px; padding-right: 12px; }

@media (max-width: 1320px) {
  .pm-table .col-time { display: none; }
}
@media (max-width: 1180px) {
  .pm-table .col-method,
  .pm-table .col-sit { display: none; }
}
@media (max-width: 1000px) {
  .pm-table .col-height { display: none; }
}

/* 弹窗内提示卡 */
.calc-tip { margin-bottom: 14px; }

/* 成熟度偏移：可点击查看公式 */
.pm-offset-btn {
  background: none; border: 0; padding: 0; cursor: pointer; border-radius: 999px;
  transition: transform .15s;
  &:hover { transform: translateY(-1px); .rk-status-badge { box-shadow: 0 2px 8px rgba(0,0,0,.12); } }
}
/* 成年身高 / PHV 年龄：可点击查看由来 */
.pm-value-btn {
  background: none; border: 0; padding: 0; cursor: pointer; font-family: inherit;
  border-radius: 4px; transition: transform .15s;
  &:hover { transform: translateY(-1px); }
}
.pm-adult-h { text-decoration: underline dotted #c4b5fd; text-underline-offset: 3px; }

/* Mirwald 推导弹窗 */
.mf-body { display: flex; flex-direction: column; gap: 12px; }
.mf-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mf-name { font-size: 15px; font-weight: 700; color: #1e293b; margin-right: 4px; }
.mf-section-title { font-size: 13px; font-weight: 600; color: #334155; padding-left: 8px; border-left: 3px solid #8b5cf6; }
.mf-inputs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.mf-input {
  background: #f8fafc; border: 1px solid #eef2f7; border-radius: 8px; padding: 8px 10px;
  display: flex; flex-direction: column; gap: 2px;
  label { font-size: 11px; color: #94a3b8; }
  b { font-size: 16px; color: #1e293b; font-family: var(--app-font-mono); font-weight: 700; }
  i { font-style: normal; font-size: 10px; color: #cbd5e1; }
}
.mf-formula {
  margin: 0; background: #f8fafc; border: 1px solid #e8edf4; border-radius: 8px;
  padding: 12px 14px; font-size: 12.5px; line-height: 1.75; color: #334155;
  font-family: var(--app-font-mono); white-space: pre-wrap;
}
.mf-table {
  width: 100%; border-collapse: collapse; font-size: 12.5px;
  border: 1px solid #e8edf4; border-radius: 8px; overflow: hidden;
  :is(th, td) { padding: 7px 12px; border-bottom: 1px solid #eef2f7; }
  thead th { background: #f8fafc; color: #64748b; font-weight: 600; text-align: left; }
  tbody tr:last-child td { border-bottom: 0; }
}
.mf-sum-row td { background: #f5f3ff; color: #5b21b6; font-weight: 600; }
.mf-result-item {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 10px 14px;
  font-size: 12.5px; color: #4c1d95;
}
.mf-note { font-size: 12px; color: #94a3b8; line-height: 1.7; }
.mf-old-saved { color: #b45309; }

/* ===== 嵌入模式：供合并页堆叠（隐藏页头、归零满铺外壳） ===== */
.app-container.is-embedded {
  padding: 0;
  :deep(.rk-dash-page) {
    margin: 0;
    padding: 0;
    min-height: 0;
    background: transparent;
  }
}

</style>
