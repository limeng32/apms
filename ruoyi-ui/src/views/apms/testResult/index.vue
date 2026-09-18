<template>
  <div class="app-container result-page">
    <!-- 搜索栏 -->
    <el-form :model="queryParams" :inline="true" ref="queryForm" class="filter-bar">
      <el-form-item label="关联任务" prop="taskId">
        <el-select v-model="queryParams.taskId" placeholder="选择测试任务" clearable style="width:220px" filterable>
          <el-option v-for="t in taskOptions" :key="t.id" :label="t.taskName" :value="t.id"/>
        </el-select>
      </el-form-item>
      <el-form-item label="运动员" prop="athleteId">
        <el-select v-model="queryParams.athleteId" placeholder="选运动员" clearable filterable style="width:160px">
          <el-option v-for="a in athleteOptions" :key="a.athleteId" :label="a.name" :value="a.athleteId"/>
        </el-select>
      </el-form-item>
      <el-form-item label="类型" prop="itemType">
        <el-select v-model="queryParams.itemType" placeholder="全部" clearable style="width:100px">
          <el-option label="指标" value="INDICATOR"/>
          <el-option label="模型" value="MODEL"/>
        </el-select>
      </el-form-item>
      <el-form-item label="选中" prop="isSelected">
        <el-select v-model="queryParams.isSelected" placeholder="全部" clearable style="width:100px">
          <el-option label="已选中" value="1"/>
          <el-option label="未选中" value="0"/>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        <el-button type="success" icon="Upload" @click="importDialogRef?.open()" :disabled="!hasImportPerm">CSV 批量导入</el-button>
      </el-form-item>
    </el-form>

    <!-- CSV 导入对话框 -->
    <csv-import-dialog ref="importDialogRef" action="/apms/test-result/import/csv" @success="handleImportSuccess" />

    <!-- 主从两栏 -->
    <el-row :gutter="16">
      <!-- 左：结果列表 -->
      <el-col :span="11">
        <div class="panel-title">
          <span>测试结果</span>
          <span class="panel-sub">共 {{ total }} 条 · 按选中显示</span>
        </div>
        <el-table :data="resultList" row-key="id" border stripe highlight-current-row
                  max-height="600" @row-click="handleRowClick">
          <el-table-column label="#号" prop="id" width="50" align="center"/>
          <el-table-column label="运动员" width="110">
            <template #default="scope">
              <span class="athlete-name">{{ scope.row.athleteName }}</span>
              <span :class="scope.row.athleteGender === 'F' ? 'female' : 'male'" class="gender">{{ scope.row.athleteGender === 'F' ? '♀' : '♂' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="80" align="center">
            <template #default="scope">
              <el-tag :type="scope.row.itemType === 'INDICATOR' ? 'primary' : 'success'" size="small" effect="dark">
                {{ scope.row.itemType === 'INDICATOR' ? '指标' : '模型' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="项目" min-width="140">
            <template #default="scope">
              <span class="item-code">{{ scope.row.indicatorCode || scope.row.modelCode }}</span>
              <span class="item-name">{{ scope.row.indicatorName || scope.row.modelName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="尝试" width="60" align="center">
            <template #default="scope">
              <el-tag v-if="scope.row.isSelected === '1'" type="success" effect="dark" size="small">★{{ scope.row.attemptNo }}</el-tag>
              <span v-else class="attempt-alt">#{{ scope.row.attemptNo }}</span>
            </template>
          </el-table-column>
          <el-table-column label="日期" width="100">
            <template #default="scope">{{ formatDate(scope.row.measureDate) }}</template>
          </el-table-column>
        </el-table>
        <pagination v-show="total>0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList"/>
      </el-col>

      <!-- 右：详情侧栏 -->
      <el-col :span="13">
        <div class="panel-title">
          <span>结果详情</span>
          <span class="panel-sub" v-if="current">
            {{ current.athleteName }} · {{ current.indicatorName || current.modelName }}
          </span>
          <span v-else class="panel-sub muted">← 点击左侧结果查看</span>
        </div>

        <div v-if="current" class="detail-panel" v-loading="detailLoading">
          <!-- Attempt 历史 -->
          <div class="attempt-section" v-if="attempts.length">
            <div class="section-title">同项目所有尝试 ({{ attempts.length }})</div>
            <el-table :data="attempts" size="small" border stripe>
              <el-table-column label="尝试" width="70" align="center">
                <template #default="scope">
                  <span v-if="scope.row.id === current.id" class="selected">★{{ scope.row.attemptNo }}</span>
                  <span v-else class="alt">#{{ scope.row.attemptNo }}</span>
                </template>
              </el-table-column>
              <el-table-column label="日期" width="110">
                <template #default="scope">{{ formatDate(scope.row.measureDate) }}</template>
              </el-table-column>
              <el-table-column label="选中" width="70" align="center">
                <template #default="scope">
                  <el-tag v-if="scope.row.isSelected === '1'" type="success" size="small">✓</el-tag>
                  <span v-else class="muted">—</span>
                </template>
              </el-table-column>
              <el-table-column label="方向" width="100" align="center">
                <template #default="scope">
                  <span class="dir-badge" :class="dirClass(scope.row.indicatorDirection)">{{ dirLabel(scope.row.indicatorDirection) }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- VALUES -->
          <div class="section-title">测试值 ({{ current.values?.length || 0 }})</div>
          <div v-if="current.values?.length" class="values-grid">
            <div v-for="v in current.values" :key="v.id" class="value-card" :class="{ derived: v.isDerived === '1' }">
              <div class="value-key">
                <span class="code">{{ v.fieldKey }}</span>
                <el-tag v-if="v.isDerived === '1'" type="info" size="small" effect="dark">派生</el-tag>
              </div>
              <div class="value-num">
                <span class="num">{{ v.numericValue ?? v.textValue ?? '—' }}</span>
                <span class="unit">{{ v.unit }}</span>
              </div>
              <div v-if="v.fieldName && v.fieldName !== v.fieldKey" class="value-label">{{ v.fieldName }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无值"/>

          <!-- REP 评价 -->
          <div class="section-title rep-title">
            REP 评价
            <span v-if="current.indicatorDirection" class="direction-tag">方向：{{ dirLabel(current.indicatorDirection) }}</span>
          </div>
          <div v-if="current.reps?.length" class="rep-list">
            <div v-for="rep in current.reps" :key="rep.id" class="rep-item" :class="'rep-' + rep.repNo">
              <div class="rep-level">{{ repLevelLabel(rep.repNo) }}</div>
              <div class="rep-value">
                <span class="num">{{ rep.value }}</span>
                <span class="unit">{{ rep.unit }}</span>
              </div>
              <div class="rep-bar">
                <div class="rep-bar-fill" :style="{ width: (25 * rep.repNo) + '%' }"></div>
              </div>
            </div>
          </div>
          <el-empty v-else description="无 REP 评价（模型或缺少参照系）"/>
        </div>
        <div v-else class="detail-empty">
          <el-empty description="选择左侧结果查看详情"/>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="ApmsTestResult">
import { listTestResult, getTestResult, listByTaskMember } from '@/api/apms/testResult'
import { listTestTask } from '@/api/apms/testTask'
import { listAthlete } from '@/api/apms/athlete'
import CsvImportDialog from '@/components/CsvImportDialog/index.vue'

const { proxy } = getCurrentInstance()

// ========= CSV 导入 =========
const importDialogRef = ref(null)
const hasImportPerm = computed(() => proxy.$checkPermi?.('apms:testResult:add'))
function handleImportSuccess() { getList() }

// ========= 查询 =========
const loading = ref(false)
const resultList = ref([])
const total = ref(0)
const queryParams = reactive({ pageNum: 1, pageSize: 10, taskId: null, athleteId: null, itemType: null, isSelected: '1' })

function getList() {
  loading.value = true
  listTestResult(queryParams).then(res => {
    resultList.value = res.rows
    total.value = res.total
    loading.value = false
  })
}
function handleQuery() { queryParams.pageNum = 1; getList() }
function resetQuery() { proxy.resetForm('queryForm'); queryParams.isSelected = '1'; handleQuery() }

// ========= 辅助下拉 =========
const taskOptions = ref([])
const athleteOptions = ref([])
listTestTask({ pageNum: 1, pageSize: 200 }).then(r => { taskOptions.value = r.rows || [] })
listAthlete({ pageNum: 1, pageSize: 300 }).then(r => { athleteOptions.value = r.rows || [] })

// ========= 主从 =========
const current = ref(null)
const attempts = ref([])
const detailLoading = ref(false)

function handleRowClick(row) {
  current.value = row
  loadDetail(row.id)
}
function loadDetail(id) {
  detailLoading.value = true
  getTestResult(id).then(res => {
    current.value = res.data
    // 查同 athlete + task_item 下的所有 attempt
    if (res.data && res.data.taskId && res.data.taskItemId && res.data.athleteId) {
      listByTaskMember(res.data.taskId, res.data.athleteId).then(r => {
        attempts.value = (r.data || []).filter(x => x.taskItemId === res.data.taskItemId)
      }).finally(() => { detailLoading.value = false })
    } else {
      detailLoading.value = false
    }
  })
}

// ========= 辅助 =========
function formatDate(d) { if (!d) return ''; return String(d).substring(0, 10) }
function dirLabel(d) { return ({ HIGHER_BETTER: '↑越大越好', LOWER_BETTER: '↓越小越好', RANGE_BEST: '≈范围' })[d] || d || '—' }
function dirClass(d) { return ({ HIGHER_BETTER: 'higher', LOWER_BETTER: 'lower' })[d] || '' }
function repLevelLabel(n) { return [null, 'Excellent ★★★★', 'Good ★★★', 'Normal ★★', 'Poor ★'][n] || '—' }

getList()
</script>

<style scoped>
.result-page { padding: 12px 16px; }
.panel-title {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; font-weight: 600; color: #1b4332;
  padding: 0 0 10px; border-bottom: 1px solid #ebeef5; margin-bottom: 12px;
}
.panel-sub { font-size: 12px; color: #909399; font-weight: 400; }
.panel-sub.muted { color: #c0c4cc; }
.filter-bar { margin-bottom: 4px; }

/* 表格 */
.athlete-name { font-weight: 500; color: #303133; margin-right: 4px; }
.gender { font-size: 12px; font-weight: 700; }
.gender.male { color: #409eff; }
.gender.female { color: #f56c6c; }
.item-code { font-family: monospace; font-weight: 500; color: #1b4332; margin-right: 6px; }
.item-name { color: #606266; font-size: 13px; }
.attempt-alt { color: #c0c4cc; }

/* 详情面板 */
.detail-panel { min-height: 500px; }
.detail-empty { min-height: 500px; display: flex; align-items: center; justify-content: center; }
.section-title {
  font-size: 13px; font-weight: 600; color: #1b4332;
  margin: 14px 0 8px; padding-left: 8px; border-left: 3px solid #1b4332;
  display: flex; align-items: center; gap: 8px;
}
.rep-title { border-left-color: #e6a23c; }
.direction-tag { font-size: 11px; color: #909399; font-weight: 400; }

/* Attempt history */
.attempt-section { margin-bottom: 8px; }
.selected { color: #67c23a; font-weight: 700; }
.alt { color: #c0c4cc; }
.muted { color: #c0c4cc; font-size: 11px; }
.dir-badge { font-size: 11px; padding: 1px 6px; border-radius: 3px; }
.dir-badge.higher { background: #f0f9eb; color: #67c23a; }
.dir-badge.lower  { background: #fdf6ec; color: #e6a23c; }

/* Values grid */
.values-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.value-card {
  background: #f6fbf7; border: 1px solid #d4e4d9; border-radius: 5px;
  padding: 10px 12px;
}
.value-card.derived { background: #f5f7fa; border-color: #dcdfe6; }
.value-key { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.value-key .code { font-family: monospace; font-size: 12px; color: #606266; font-weight: 600; }
.value-num { display: flex; align-items: baseline; gap: 4px; }
.value-num .num { font-size: 22px; font-weight: 700; color: #1b4332; font-family: Menlo, monospace; }
.value-num .unit { font-size: 12px; color: #909399; }
.value-label { font-size: 11px; color: #909399; margin-top: 2px; }

/* REP */
.rep-list { display: flex; flex-direction: column; gap: 8px; }
.rep-item {
  display: grid; grid-template-columns: 130px 120px 1fr; gap: 12px; align-items: center;
  padding: 10px 14px; border-radius: 6px; border: 1px solid;
}
.rep-item.rep-1 { background: #f0f9eb; border-color: #67c23a; }
.rep-item.rep-2 { background: #fdf6ec; border-color: #e6a23c; }
.rep-item.rep-3 { background: #f4f4f5; border-color: #909399; }
.rep-item.rep-4 { background: #fef0f0; border-color: #f56c6c; }
.rep-level { font-weight: 700; }
.rep-value { display: flex; gap: 4px; align-items: baseline; }
.rep-value .num { font-size: 18px; font-weight: 700; font-family: Menlo, monospace; }
.rep-bar { height: 6px; background: #ebeef5; border-radius: 3px; overflow: hidden; }
.rep-bar-fill { height: 100%; background: #1b4332; border-radius: 3px; transition: width .3s; }
</style>
