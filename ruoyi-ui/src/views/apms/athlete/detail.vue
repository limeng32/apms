<template>
  <div class="app-container" v-loading="loading">
    <!-- 顶部：基本信息卡片 -->
    <div class="athlete-header">
      <div class="header-left">
        <el-avatar :size="80" :style="{ backgroundColor: headerBg }" class="avatar">
          {{ athlete.name ? athlete.name.charAt(0) : '?' }}
        </el-avatar>
        <div class="header-info">
          <div class="name-row">
            <span class="name">{{ athlete.name || '-' }}</span>
            <el-tag v-if="athlete.gender === 'M'" type="primary" effect="plain">男</el-tag>
            <el-tag v-else-if="athlete.gender === 'F'" type="danger" effect="plain">女</el-tag>
            <el-tag v-if="athlete.position" type="info" effect="plain">{{ positionLabel(athlete.position) }}</el-tag>
            <el-tag :type="statusTagType(athlete.status)" effect="plain">{{ statusLabel(athlete.status) }}</el-tag>
          </div>
          <div class="meta-row">
            <span><strong>队伍</strong>{{ athlete.teamName || '-' }}</span>
            <span><strong>球衣号</strong>{{ athlete.jerseyNo || '-' }}</span>
            <span><strong>年龄</strong>{{ athlete.age ?? '-' }} 岁</span>
            <span><strong>生日</strong>{{ athlete.birthday || '-' }}</span>
            <span><strong>电话</strong>{{ athlete.phone || '-' }}</span>
          </div>
        </div>
      </div>
      <div class="header-right">
        <el-button @click="goBack" icon="Back">返回列表</el-button>
      </div>
    </div>

    <!-- 统计卡片区 -->
    <el-row :gutter="12" class="stat-cards">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-num">{{ groupHistory.length }}</div>
          <div class="stat-label">小组归属次数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-num">{{ bodyMeasures.length }}</div>
          <div class="stat-label">体态测量记录</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-num">
            <el-tag v-if="rtpStatus" :type="rtpTagType(rtpStatus.status)" effect="dark" class="rtp-tag">
              {{ rtpLabel(rtpStatus.status) }}
            </el-tag>
            <span v-else class="rtp-na">未评估</span>
          </div>
          <div class="stat-label">RTP 参训状态</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-num">{{ phvRecords.length }}</div>
          <div class="stat-label">PHV 发育评估次数</div>
        </div>
      </el-col>
    </el-row>

    <!-- Tab 区域 -->
    <el-tabs v-model="activeTab" class="detail-tabs">
      <!-- Tab 1: 小组归属 -->
      <el-tab-pane label="小组归属" name="group">
        <div class="tab-toolbar">
          <el-button type="primary" size="small" icon="Plus" @click="showJoinDialog = true" v-hasPermi="['apms:athlete:edit']">加入新小组</el-button>
          <el-button v-if="currentGroup" type="danger" size="small" icon="Minus" @click="handleLeave" v-hasPermi="['apms:athlete:edit']">离开当前小组</el-button>
        </div>
        <el-table :data="groupHistory" stripe size="default">
          <el-table-column label="小组" prop="deptName" width="200"/>
          <el-table-column label="类型" prop="deptTypeName" width="110">
            <template #default="scope">
              <el-tag size="small" :type="scope.row.deptTypeName === '训练小组' ? 'primary' : scope.row.deptTypeName === '科研小组' ? 'success' : 'warning'">{{ scope.row.deptTypeName }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="加入日期" prop="joinDate" width="120"/>
          <el-table-column label="离开日期" prop="leaveDate" width="120">
            <template #default="scope">
              <span v-if="scope.row.leaveDate">{{ scope.row.leaveDate }}</span>
              <el-tag v-else type="success" size="small">当前在组</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="scope">
              <el-tag :type="scope.row.status === '0' ? 'success' : 'info'" size="small">{{ scope.row.status === '0' ? '在组' : '已离组' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作人" prop="createBy" width="120"/>
        </el-table>
        <el-empty v-if="groupHistory.length === 0" description="暂无小组归属记录"/>
      </el-tab-pane>

      <!-- Tab 2: 体态测量 -->
      <el-tab-pane label="体态测量" name="body">
        <div class="tab-toolbar">
          <el-button type="primary" size="small" icon="Plus" @click="openBodyMeasureDialog" v-hasPermi="['apms:athlete:edit']">新增测量</el-button>
          <el-button type="primary" size="small" plain icon="DataAnalysis" @click="showTrend = !showTrend">
            {{ showTrend ? '隐藏趋势' : '查看身高/体重趋势' }}
          </el-button>
        </div>

        <!-- 趋势区 -->
        <div v-if="showTrend && bodyMeasures.length >= 2" class="trend-box">
          <div class="trend-title">近 6 次变化趋势</div>
          <el-table :data="bodyMeasures.slice(0, 6)" stripe size="small">
            <el-table-column label="日期" prop="measureDate" width="120"/>
            <el-table-column label="身高(cm)" prop="height" align="right"/>
            <el-table-column label="坐高(cm)" prop="sitHeight" align="right"/>
            <el-table-column label="体重(kg)" prop="weight" align="right"/>
            <el-table-column label="腿长(cm)" width="100" align="right">
              <template #default="scope">{{ scope.row.legLength != null ? Number(scope.row.legLength).toFixed(1) : '-' }}</template>
            </el-table-column>
            <el-table-column label="体脂率(%)" prop="bodyFatRate" align="right"/>
          </el-table>
        </div>

        <!-- 完整列表 -->
        <el-table :data="bodyMeasures" stripe size="default">
          <el-table-column label="日期" prop="measureDate" width="120"/>
          <el-table-column label="身高(cm)" prop="height" align="right"/>
          <el-table-column label="坐高(cm)" prop="sitHeight" align="right"/>
          <el-table-column label="体重(kg)" prop="weight" align="right"/>
          <el-table-column label="腿长(cm)" width="100" align="right">
            <template #default="scope">{{ scope.row.legLength != null ? Number(scope.row.legLength).toFixed(1) : (scope.row.height && scope.row.sitHeight ? (Number(scope.row.height) - Number(scope.row.sitHeight)).toFixed(1) : '-') }}</template>
          </el-table-column>
          <el-table-column label="体脂率(%)" prop="bodyFatRate" align="right"/>
          <el-table-column label="腰围(cm)" prop="waist" align="right"/>
          <el-table-column label="来源" prop="dataSource" width="100"/>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="scope">
              <el-button link type="danger" size="small" icon="Delete" @click="handleDeleteMeasure(scope.row)" v-hasPermi="['apms:athlete:remove']"/>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="bodyMeasures.length === 0" description="暂无体态测量记录"/>
      </el-tab-pane>

      <!-- Tab 3: RTP 状态 -->
      <el-tab-pane label="RTP 参训状态" name="rtp">
        <div class="tab-toolbar">
          <el-button type="primary" size="small" icon="Edit" @click="showRtpDialog = true" v-hasPermi="['apms:athlete:edit']">更新状态</el-button>
          <el-button v-if="rtpStatus" type="warning" size="small" icon="RefreshLeft" @click="handleClearRtp" v-hasPermi="['apms:athlete:edit']">清除为未评估</el-button>
        </div>

        <!-- 当前状态卡片 -->
        <div class="rtp-current" v-if="rtpStatus">
          <div class="rtp-status-box" :class="'rtp-' + rtpStatus.status">
            <div class="rtp-icon">
              <component :is="rtpIcon(rtpStatus.status)" />
            </div>
            <div class="rtp-info">
              <div class="rtp-current-label">当前状态</div>
              <div class="rtp-current-value">{{ rtpLabel(rtpStatus.status) }}</div>
              <div class="rtp-reason" v-if="rtpStatus.reason">原因：{{ rtpStatus.reason }}</div>
              <div class="rtp-limit" v-if="rtpStatus.trainingLimit">训练限制：{{ rtpStatus.trainingLimit }}</div>
              <div class="rtp-next" v-if="rtpStatus.nextReviewDate">下次复核：{{ rtpStatus.nextReviewDate }}</div>
              <div class="rtp-updated">更新于 {{ rtpStatus.updatedTime }} · {{ rtpStatus.updatedBy }}</div>
            </div>
          </div>
        </div>
        <div v-else class="rtp-current rtp-empty">
          <el-empty description="尚未进行 RTP 评估" :image-size="80"/>
        </div>

        <!-- 变更历史 -->
        <div v-if="rtpLogs.length > 0" class="rtp-history">
          <div class="section-title">变更历史</div>
          <el-table :data="rtpLogs" stripe size="default">
            <el-table-column label="时间" prop="operateTime" width="180"/>
            <el-table-column label="变更" width="160">
              <template #default="scope">
                <span :class="'rtp-badge rtp-' + (scope.row.fromStatus || 'na')">{{ rtpLabel(scope.row.fromStatus) }}</span>
                <span class="arrow">→</span>
                <span :class="'rtp-badge rtp-' + (scope.row.toStatus || 'na')">{{ rtpLabel(scope.row.toStatus) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="原因" prop="reason"/>
            <el-table-column label="训练限制" prop="trainingLimit"/>
            <el-table-column label="下次复核" prop="nextReviewDate" width="120"/>
            <el-table-column label="操作人" prop="operatorName" width="100"/>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- Tab 4: PHV 发育 -->
      <el-tab-pane label="PHV 生长发育" name="phv">
        <div class="tab-toolbar">
          <el-dropdown v-if="bodyMeasures.length > 0" @command="handlePhvDropdown" v-hasPermi="['apms:athlete:edit']">
            <el-button type="primary" size="small" icon="DataLine">计算 PHV <el-icon class="el-icon--right"><ArrowDown/></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="m in bodyMeasures.slice(0, 10)" :key="m.id" :command="m">
                  {{ m.measureDate }} · 身高{{ m.height }}/坐高{{ m.sitHeight }}/体重{{ m.weight }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button size="small" plain icon="DataLine" @click="showPhvDialog = true" v-hasPermi="['apms:athlete:edit']">手动输入计算</el-button>
        </div>

        <!-- 最新 PHV 摘要 -->
        <div v-if="latestPhv" class="phv-summary">
          <div class="phv-summary-title">最新 PHV 评估摘要</div>
          <el-descriptions :column="4" border size="default">
            <el-descriptions-item label="评估日期">{{ latestPhv.measureDate }}</el-descriptions-item>
            <el-descriptions-item label="精确年龄">{{ latestPhv.decimalAge != null ? Number(latestPhv.decimalAge).toFixed(2) + ' 岁' : '-' }}</el-descriptions-item>
            <el-descriptions-item label="成熟度偏移">
              <span :class="Number(latestPhv.maturityOffset) < 0 ? 'text-warning' : 'text-success'">
                {{ latestPhv.maturityOffset != null ? Number(latestPhv.maturityOffset).toFixed(4) : '-' }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="预计 PHV 年龄">
              <span class="phv-age">{{ latestPhv.predictedPhvAge != null ? Number(latestPhv.predictedPhvAge).toFixed(2) + ' 岁' : '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="身高">{{ latestPhv.height }} cm</el-descriptions-item>
            <el-descriptions-item label="坐高">{{ latestPhv.sitHeight }} cm</el-descriptions-item>
            <el-descriptions-item label="腿长">{{ latestPhv.legLength != null ? latestPhv.legLength : '-' }} cm</el-descriptions-item>
            <el-descriptions-item label="体重">{{ latestPhv.weight }} kg</el-descriptions-item>
          </el-descriptions>
          <div class="phv-tip">
            <el-icon><InfoFilled/></el-icon>
            <span>成熟度偏移 < 0 表示尚未到达 PHV；> 0 表示已越过 PHV。算法：Mirwald v{{ latestPhv.mirwaldVersion || '2014.1' }}</span>
          </div>
        </div>

        <!-- PHV 历史 -->
        <el-table v-if="phvRecords.length > 0" :data="phvRecords" stripe size="default" style="margin-top: 16px">
          <el-table-column label="日期" prop="measureDate" width="120"/>
          <el-table-column label="年龄" width="90" align="right">
            <template #default="scope">{{ Number(scope.row.decimalAge).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="身高(cm)" prop="height" align="right"/>
          <el-table-column label="坐高(cm)" prop="sitHeight" align="right"/>
          <el-table-column label="体重(kg)" prop="weight" align="right"/>
          <el-table-column label="腿长(cm)" width="90" align="right">
            <template #default="scope">{{ scope.row.legLength != null ? Number(scope.row.legLength).toFixed(1) : '-' }}</template>
          </el-table-column>
          <el-table-column label="成熟度偏移" width="120" align="right">
            <template #default="scope">
              <span :class="Number(scope.row.maturityOffset) < 0 ? 'text-warning' : 'text-success'">
                {{ Number(scope.row.maturityOffset).toFixed(4) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="预计 PHV 年龄" width="120" align="right">
            <template #default="scope">{{ Number(scope.row.predictedPhvAge).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="scope">
              <el-button link type="danger" size="small" icon="Delete" @click="handleDeletePhv(scope.row)" v-hasPermi="['apms:athlete:remove']"/>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="phvRecords.length === 0" description="暂无 PHV 评估记录"/>
      </el-tab-pane>
    </el-tabs>

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
          <el-col :span="12"><el-form-item label="来源">
            <el-select v-model="bodyForm.dataSource" style="width: 100%">
              <el-option label="手动录入" value="manual"/>
              <el-option label="CSV导入" value="csv"/>
              <el-option label="任务流程" value="task"/>
            </el-select>
          </el-form-item></el-col>
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
import { useDict } from '@/utils/dict'
import { ArrowDown, InfoFilled, CircleCheck, Warning, CircleClose } from '@element-plus/icons-vue'

const { proxy } = getCurrentInstance()
const route = useRoute()
const { apms_position, apms_athlete_status } = useDict('apms_position', 'apms_athlete_status')

const athleteId = computed(() => Number(route.params.athleteId))
const loading = ref(true)
const activeTab = ref('group')
const showTrend = ref(false)

// 主数据
const athlete = ref({})
const groupHistory = ref([])
const currentGroup = ref(null)
const bodyMeasures = ref([])
const rtpStatus = ref(null)
const rtpLogs = ref([])
const phvRecords = ref([])

const latestPhv = computed(() => phvRecords.value.length > 0 ? phvRecords.value[0] : null)

// 字典辅助
const positionOptions = computed(() => apms_position.value || [])
const statusOptions = computed(() => apms_athlete_status.value || [])
function positionLabel(val) { return (positionOptions.value.find(d => d.dictValue === val) || {}).dictLabel || val }
function statusLabel(val) { return (statusOptions.value.find(d => d.dictValue === val) || {}).dictLabel || val }
function statusTagType(val) { return (statusOptions.value.find(d => d.dictValue === val) || {}).listClass || 'info' }

// 小组 dept 选项（dept_type 30/40/50）
const groupDeptOptions = ref([])
async function loadGroupDeptOptions() {
  const res = await listDept({ status: '0' })
  groupDeptOptions.value = (res.data || []).filter(d => ['30', '40', '50', 30, 40, 50].includes(d.deptType))
}

// 头像背景色（根据 name char code 生成固定颜色）
const headerBg = computed(() => {
  const colors = ['#2d6a4f', '#1b4332', '#40916c', '#52b788', '#081c15', '#2a9d8f', '#264653']
  const c = (athlete.value.name || '?').charCodeAt(0) || 0
  return colors[c % colors.length]
})

// ===== RTP 辅助 =====
function rtpLabel(status) {
  const map = { g: '正常参训', y: '限制参训', r: '不建议参训' }
  return map[status] ?? (status ? status : '未评估')
}
function rtpTagType(status) {
  const map = { g: 'success', y: 'warning', r: 'danger' }
  return map[status] || 'info'
}
function rtpIcon(status) {
  const map = { g: CircleCheck, y: Warning, r: CircleClose }
  return map[status] || Warning
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

<style scoped>
.athlete-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  background: linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%);
  border-radius: 10px;
  margin-bottom: 16px;
  color: #fff;
}
.header-left { display: flex; align-items: center; gap: 20px; }
.avatar { font-size: 32px; font-weight: 600; flex-shrink: 0; }
.header-info .name-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.header-info .name { font-size: 22px; font-weight: 600; }
.header-info .meta-row { display: flex; flex-wrap: wrap; gap: 18px; font-size: 13px; opacity: 0.92; }
.header-info .meta-row strong { margin-right: 4px; opacity: 0.7; font-weight: 500; }
.header-right { align-self: center; }
.header-right .el-button { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.3); color: #fff; }
.header-right .el-button:hover { background: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.5); }

.stat-cards { margin-bottom: 16px; }
.stat-card {
  background: #fff; border: 1px solid #ebeef5; border-radius: 8px;
  padding: 14px 16px; text-align: center;
}
.stat-num { font-size: 22px; font-weight: 600; color: #1b4332; }
.stat-label { font-size: 12px; color: #909399; margin-top: 4px; }
.rtp-na { font-size: 16px; color: #c0c4cc; }
.rtp-tag { font-size: 13px !important; }

.detail-tabs .tab-toolbar { display: flex; gap: 8px; margin-bottom: 12px; }

/* RTP 状态卡片 */
.rtp-current { margin-bottom: 16px; }
.rtp-status-box {
  display: flex; gap: 20px; padding: 18px 22px;
  border-radius: 8px; border: 1px solid #ebeef5;
}
.rtp-icon { font-size: 48px; display: flex; align-items: center; }
.rtp-status-box.rtp-g .rtp-icon { color: #67c23a; }
.rtp-status-box.rtp-y .rtp-icon { color: #e6a23c; }
.rtp-status-box.rtp-r .rtp-icon { color: #f56c6c; }
.rtp-info { flex: 1; }
.rtp-current-label { font-size: 13px; color: #909399; }
.rtp-current-value { font-size: 22px; font-weight: 600; margin: 4px 0 8px; }
.rtp-status-box.rtp-g .rtp-current-value { color: #67c23a; }
.rtp-status-box.rtp-y .rtp-current-value { color: #e6a23c; }
.rtp-status-box.rtp-r .rtp-current-value { color: #f56c6c; }
.rtp-reason, .rtp-limit, .rtp-next { font-size: 13px; color: #606266; margin-top: 4px; }
.rtp-updated { font-size: 12px; color: #909399; margin-top: 10px; }
.rtp-empty { border: 1px dashed #dcdfe6; border-radius: 8px; padding: 8px; }

.rtp-history .section-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 10px; }
.rtp-badge {
  display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;
}
.rtp-badge.rtp-g { background: #f0f9eb; color: #67c23a; }
.rtp-badge.rtp-y { background: #fdf6ec; color: #e6a23c; }
.rtp-badge.rtp-r { background: #fef0f0; color: #f56c6c; }
.rtp-badge.rtp-na { background: #f4f4f5; color: #909399; }
.rtp-history .arrow { margin: 0 6px; color: #c0c4cc; }

/* PHV */
.phv-summary { background: #fafbfc; border: 1px solid #ebeef5; border-radius: 8px; padding: 16px 20px; }
.phv-summary-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; }
.phv-age { font-weight: 600; color: #2d6a4f; font-size: 15px; }
.phv-tip { margin-top: 12px; font-size: 12px; color: #909399; display: flex; align-items: center; gap: 4px; }

.text-warning { color: #e6a23c; font-weight: 600; }
.text-success { color: #67c23a; font-weight: 600; }

/* 趋势区 */
.trend-box { margin-bottom: 12px; }
.trend-title { font-size: 13px; font-weight: 600; color: #606266; margin-bottom: 8px; }
</style>
