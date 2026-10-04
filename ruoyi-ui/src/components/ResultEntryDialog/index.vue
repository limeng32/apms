<template>
  <el-dialog :title="dialogTitle" v-model="visible" width="780px" append-to-body @close="reset">
    <el-form :model="form" label-width="84px" @submit.prevent>
      <el-row :gutter="12">
        <el-col v-if="mode === 'free'" :span="24">
          <el-form-item label="关联任务">
            <el-select v-model="form.taskId" placeholder="不绑定任务（散录，不计入任务进度）" clearable
                       style="width:100%" @change="loadItems">
              <el-option v-for="t in taskOptions" :key="t.id" :label="t.taskName" :value="t.id"/>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col v-if="mode === 'task'" :span="24">
          <el-form-item label="任务">
            <span class="re-readonly">{{ ctx.taskName }}</span>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="运动员" required>
            <el-select v-if="mode === 'free'" v-model="form.athleteId" filterable
                       placeholder="选择运动员" style="width:100%" @change="loadExisting">
              <el-option v-for="a in athleteOptions" :key="a.athleteId"
                         :label="a.name + (a.teamName ? '（' + a.teamName + '）' : '')" :value="a.athleteId"/>
            </el-select>
            <span v-else class="re-readonly">{{ ctx.athleteName }}</span>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="测试日期" required>
            <el-date-picker v-model="form.measureDate" type="date" value-format="YYYY-MM-DD" style="width:100%"/>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="场次">
            <el-input v-model="form.sessionKey" placeholder="如 S1（可选）"/>
          </el-form-item>
        </el-col>
        <el-col v-if="mode === 'free' && !form.taskId" :span="12">
          <el-form-item label="关联模型">
            <el-select v-model="form.freeModelId" placeholder="散录一个模型测试（可选）" clearable
                       filterable style="width:100%" @change="onFreeModelChange">
              <el-option v-for="m in modelOptions" :key="m.id"
                         :label="m.name + (m.code ? '（' + m.code + '）' : '')" :value="m.id"/>
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-alert v-if="comboModels.length" type="warning" :closable="false" show-icon style="margin-bottom:10px">
        <template #title>
          本任务含 {{ comboModels.length }} 个组合模型（{{ comboModels }}），其成绩由综合评分模块生成，不在此录入。
        </template>
      </el-alert>

      <!-- ========== 直接指标 ========== -->
      <el-form-item label="直接指标">
        <div class="re-item-box" v-loading="loading">
          <table v-if="rows.length" class="re-table">
            <thead>
              <tr>
                <th class="col-name">项目</th>
                <th class="text-center col-unit">单位 · 方向</th>
                <th class="text-center col-best">现最佳</th>
                <th class="col-input">本次成绩</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r._key">
                <td>
                  <span class="re-code">{{ r.indicatorCode }}</span>
                  <span class="re-name">{{ r.indicatorName }}</span>
                </td>
                <td class="text-center re-muted">
                  <span v-if="r.indicatorUnit" class="re-unit">{{ r.indicatorUnit }}</span>
                  <span v-else>—</span>
                  <template v-if="r.indicatorDirection"> · {{ dirLabel(r.indicatorDirection) }}</template>
                </td>
                <td class="text-center re-muted re-mono">
                  {{ bestMap[r._key] ?? '—' }}<span v-if="bestMap[r._key] != null && bestMap[r._key] !== '' && r.indicatorUnit" class="re-best-unit">{{ r.indicatorUnit }}</span>
                </td>
                <td>
                  <el-input v-model="r.input" placeholder="数值" clearable class="re-input">
                    <template v-if="r.indicatorUnit" #append><span class="re-input-unit">{{ r.indicatorUnit }}</span></template>
                  </el-input>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="re-empty">暂无可录入的直接指标</div>
        </div>
      </el-form-item>

      <!-- ========== 模型结构化采集（字段由模型配置驱动，不写死任何模型） ========== -->
      <el-form-item v-for="mf in modelForms" :key="mf._uid" :label="mf === modelForms[0] ? '模型测试' : ''">
        <div class="re-model-card">
          <div class="re-model-head">
            <div>
              <span class="re-model-name">{{ mf.modelName }}</span>
              <span class="re-model-code">{{ mf.modelCode }}</span>
            </div>
            <el-button link type="primary" size="small" @click="openDevice(mf)">
              <el-icon style="margin-right:2px"><Connection /></el-icon>设备采集
            </el-button>
          </div>
          <div class="re-field-grid">
            <div v-for="f in mf.inputFields" :key="f.fieldId" class="re-field">
              <label class="re-field-label">
                <span v-if="f.isRequired === '1'" class="re-req">*</span>{{ f.fieldName }}
                <span class="re-field-key">{{ f.fieldKey }}</span>
              </label>
              <el-input v-model="f.value" :placeholder="dataTypeText(f.dataType)" clearable size="small">
                <template v-if="f.unit" #append><span class="re-input-unit">{{ f.unit }}</span></template>
              </el-input>
            </div>
          </div>
          <div v-if="mf.derivedFields.length" class="re-derived">
            <span class="re-derived-title">保存后系统自动计算：</span>
            <span v-for="d in mf.derivedFields" :key="d.fieldId" class="re-derived-chip">
              {{ d.fieldName }}<i v-if="d.unit">（{{ d.unit }}）</i>
            </span>
          </div>
          <div v-if="!mf.inputFields.length" class="re-empty re-empty-sm">
            该模型未配置人工采集字段（collect_mode=INPUT），无法录入
          </div>
        </div>
      </el-form-item>

      <el-alert type="info" :closable="false" show-icon
        title="只填本次已测项目即可；指标自动参与最佳试次判定与 REP 评价，模型原始数据保存后自动产出派生结果。"/>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取 消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存成绩</el-button>
    </template>

    <!-- 设备采集假门禁：任何密钥都返回失效 -->
    <el-dialog title="设备采集 · 密钥校验" v-model="device.visible" width="440px" append-to-body>
      <el-alert v-if="device.error" type="error" :closable="false" show-icon style="margin-bottom:12px"
                :title="device.error"/>
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:12px"
                :title="`目标模型：${device.modelName}（${device.modelCode}）。设备自动采集需预先开通并颁发有效密钥。`"/>
      <el-input v-model="device.key" placeholder="请输入设备密钥（API Key）" clearable
                @keyup.enter="submitDevice">
        <template #prepend><el-icon><Key /></el-icon></template>
      </el-input>
      <template #footer>
        <el-button @click="device.visible = false">关 闭</el-button>
        <el-button type="primary" :loading="device.loading" @click="submitDevice">校验并采集</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { Connection, Key } from '@element-plus/icons-vue'
import { listTestTask, listTaskItem } from '@/api/apms/testTask'
import { listAthlete } from '@/api/apms/athlete'
import { listIndicator } from '@/api/apms/indicator'
import { listField, listTestModel } from '@/api/apms/testModel'
import { addTestResult, listByTaskMember, pushDeviceModel } from '@/api/apms/testResult'

const { proxy } = getCurrentInstance()
const emit = defineEmits(['success'])

const visible = ref(false)
const saving = ref(false)
const loading = ref(false)
const mode = ref('free') // free | task
const ctx = reactive({ taskId: null, taskName: '', athleteId: null, athleteName: '' })

const form = reactive({ taskId: null, athleteId: null, measureDate: '', sessionKey: '', freeModelId: null })
const taskOptions = ref([])
const athleteOptions = ref([])
const modelOptions = ref([])
const rows = ref([])
const bestMap = ref({})
// 模型结构化表单（配置驱动）
const modelForms = ref([])
// 任务内组合模型（不开放录入）名称
const comboModels = ref([])
// 指标 id → 单位（任务项 join 不带单位，用指标库补齐）
const unitMap = ref({})

// 设备假门禁
const device = reactive({ visible: false, loading: false, key: '', error: '', modelName: '', modelCode: '' })

const dialogTitle = computed(() => mode.value === 'task'
  ? `录入成绩 · ${ctx.athleteName || ''}`
  : '手动录入测试结果')

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dirLabel(d) {
  return d === 'HIGHER_BETTER' ? '越高越好' : d === 'LOWER_BETTER' ? '越低越好' : (d || '—')
}
function dataTypeText(t) {
  return t === 'text' ? '文本' : '数值'
}

/** 方案一入口：任务详情里给某队员录 */
async function openForTask(task) {
  mode.value = 'task'
  Object.assign(ctx, {
    taskId: task.taskId, taskName: task.taskName,
    athleteId: task.athleteId, athleteName: task.athleteName
  })
  Object.assign(form, { taskId: task.taskId, athleteId: task.athleteId, measureDate: today(), sessionKey: '', freeModelId: null })
  visible.value = true
  await ensureBaseOptions()
  await loadItems()
  await loadExisting()
}

/** 方案二入口：结果页自由录 */
async function openFree() {
  mode.value = 'free'
  Object.assign(ctx, { taskId: null, taskName: '', athleteId: null, athleteName: '' })
  Object.assign(form, { taskId: null, athleteId: null, measureDate: today(), sessionKey: '', freeModelId: null })
  rows.value = []
  bestMap.value = {}
  modelForms.value = []
  comboModels.value = []
  visible.value = true
  await ensureBaseOptions()
  await loadItems()
}

async function ensureBaseOptions() {
  if (!taskOptions.value.length) {
    const [t, a, m] = await Promise.all([
      listTestTask({ pageSize: 999 }),
      listAthlete({ pageSize: 999, status: '0' }),
      listTestModel({ pageNum: 1, pageSize: 999, status: '0' })
    ])
    taskOptions.value = t.rows || []
    athleteOptions.value = a.rows || []
    modelOptions.value = (m.rows || []).filter(x => x.isCombo !== '1')
  }
}

async function loadItems() {
  loading.value = true
  bestMap.value = {}
  modelForms.value = []
  comboModels.value = []
  try {
    if (form.taskId) {
      await ensureUnitMap()
      const items = await listTaskItem(form.taskId)
      const all = items.data || items || []
      rows.value = all
        .filter(it => it.itemType === 'INDICATOR')
        .map(it => tagRow({
          ...it,
          indicatorUnit: it.indicatorId != null
            ? (unitMap.value[it.indicatorId] || it.indicatorUnit || '')
            : (it.indicatorUnit || '')
        }))
      // 模型测试项 → 按字段配置构建结构化表单（组合模型除外）
      const modelItems = all.filter(it => it.itemType === 'MODEL')
      const forms = []
      for (const it of modelItems) {
        const mf = await buildModelForm({ modelId: it.modelId, modelCode: it.modelCode, modelName: it.modelName },
          { taskItemId: it.id })
        if (mf) forms.push(mf)
        else comboModels.value.push(it.modelName || it.modelCode)
      }
      modelForms.value = forms
    } else if (mode.value === 'free') {
      const res = await listIndicator({ pageNum: 1, pageSize: 999, status: '0' })
      rows.value = (res.rows || []).map(i => tagRow({
        itemType: 'INDICATOR', indicatorId: i.id, indicatorCode: i.code,
        indicatorName: i.name, indicatorUnit: i.unit, indicatorDirection: i.evaluationDirection
      }))
      if (form.freeModelId) await onFreeModelChange(form.freeModelId)
    }
  } finally {
    loading.value = false
  }
  if (form.athleteId) await loadExisting()
}

async function onFreeModelChange(modelId) {
  modelForms.value = []
  comboModels.value = []
  if (!modelId) return
  const m = modelOptions.value.find(x => x.id === modelId)
  if (!m) return
  const mf = await buildModelForm(m, { taskItemId: null })
  if (mf) modelForms.value = [mf]
}

/**
 * 按模型字段配置构建结构化表单（纯配置驱动：任意模型接入自动生效）。
 * 组合模型返回 null（由调用方归入不支持提示）。
 */
async function buildModelForm(model, { taskItemId }) {
  if (model.isCombo === '1') return null
  const res = await listField(model.modelId || model.id)
  const fields = (res.data || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  const decorate = f => ({ ...f, value: '' })
  return {
    _uid: taskItemId != null ? `ti:${taskItemId}` : `free:${model.modelId || model.id}`,
    taskItemId: taskItemId ?? null,
    modelId: model.modelId || model.id,
    modelCode: model.modelCode || model.code,
    modelName: model.modelName || model.name,
    inputFields: fields.filter(f => f.collectMode !== 'DERIVED').map(decorate),
    derivedFields: fields.filter(f => f.collectMode === 'DERIVED')
  }
}

/** 加载启用指标的单位映射（仅一次） */
async function ensureUnitMap() {
  if (Object.keys(unitMap.value).length) return
  const res = await listIndicator({ pageNum: 1, pageSize: 999, status: '0' })
  const map = {}
  for (const i of (res.rows || [])) map[i.id] = i.unit
  unitMap.value = map
}

function tagRow(it) {
  return { ...it, itemType: 'INDICATOR', _key: `I:${it.indicatorId}`, input: '' }
}

/** 载入该队员在该任务下的已选最佳成绩（仅任务模式展示指标） */
async function loadExisting() {
  bestMap.value = {}
  if (!form.taskId || !form.athleteId) return
  const list = await listByTaskMember(form.taskId, form.athleteId)
  for (const r of (list.data || [])) {
    if (r.isSelected !== '1' || r.itemType !== 'INDICATOR') continue
    const v = primaryValue(r)
    if (v != null) bestMap.value[`I:${r.indicatorId}`] = v
  }
}

function primaryValue(result) {
  const vals = result.values || []
  const main = vals.find(v => v.fieldKey === 'result') || vals[0]
  return main ? (main.numericValue ?? main.textValue) : null
}

async function submit() {
  if (!form.athleteId) return proxy.$modal.msgWarning('请选择运动员')
  if (!form.measureDate) return proxy.$modal.msgWarning('请选择测试日期')

  const filledIndicators = rows.value.filter(r => r.input !== '' && r.input != null && String(r.input).trim() !== '')
  // 每个模型只取有值的字段；同时在前端做一次必填校验（后端会强校验）
  const modelPayloads = []
  for (const mf of modelForms.value) {
    const filledFields = mf.inputFields.filter(f => f.value !== '' && f.value != null && String(f.value).trim() !== '')
    if (!filledFields.length) continue
    const missing = mf.inputFields.find(f => f.isRequired === '1'
      && (f.value === '' || f.value == null || String(f.value).trim() === ''))
    if (missing) return proxy.$modal.msgWarning(`模型「${mf.modelName}」的「${missing.fieldName}」为必填项`)
    modelPayloads.push({ mf, fields: filledFields })
  }

  if (!filledIndicators.length && !modelPayloads.length) {
    return proxy.$modal.msgWarning('请至少填写一项成绩')
  }

  const count = filledIndicators.length + modelPayloads.length
  try {
    await proxy.$modal.confirm(`将为 ${mode.value === 'task' ? ctx.athleteName : '该运动员'} 保存 ${count} 项测试结果，是否继续？`)
  } catch {
    return
  }
  saving.value = true
  try {
    for (const r of filledIndicators) {
      const num = Number(String(r.input).trim())
      await addTestResult({
        result: {
          taskId: form.taskId || null,
          taskItemId: form.taskId ? (r.id ?? null) : null,
          athleteId: form.athleteId,
          itemType: 'INDICATOR',
          indicatorId: r.indicatorId,
          modelId: null,
          measureDate: form.measureDate,
          sessionKey: form.sessionKey || null,
          isValid: '1',
          isSelected: '1',
          dataSource: 'MANUAL'
        },
        values: [{
          indicatorId: r.indicatorId,
          modelId: null,
          fieldKey: 'result',
          isDerived: '0',
          numericValue: Number.isFinite(num) ? num : null,
          textValue: Number.isFinite(num) ? null : String(r.input).trim()
        }]
      })
    }
    for (const { mf, fields } of modelPayloads) {
      const numericType = (f) => f.dataType === 'decimal' || f.dataType === 'number'
      await addTestResult({
        result: {
          taskId: form.taskId || null,
          taskItemId: mf.taskItemId,
          athleteId: form.athleteId,
          itemType: 'MODEL',
          indicatorId: null,
          modelId: mf.modelId,
          measureDate: form.measureDate,
          sessionKey: form.sessionKey || null,
          isValid: '1',
          isSelected: '1',
          dataSource: 'MANUAL'
        },
        values: fields.map(f => {
          const raw = String(f.value).trim()
          const num = Number(raw)
          return {
            fieldId: f.id,
            fieldKey: f.fieldKey,
            fieldName: f.fieldName,
            unit: f.unit || null,
            isDerived: '0',
            numericValue: numericType(f) && Number.isFinite(num) ? num : null,
            textValue: !numericType(f) ? raw : null
          }
        })
      })
    }
    proxy.$modal.msgSuccess(`已保存 ${count} 项测试结果`)
    visible.value = false
    emit('success', { taskId: form.taskId, athleteId: form.athleteId })
  } finally {
    saving.value = false
  }
}

// ============ 设备采集（假门禁） ============
function openDevice(mf) {
  Object.assign(device, {
    visible: true, loading: false, key: '', error: '',
    modelName: mf.modelName, modelCode: mf.modelCode
  })
}
async function submitDevice() {
  if (!device.key.trim()) {
    device.error = '请输入设备密钥'
    return
  }
  device.loading = true
  device.error = ''
  try {
    // 当前为假门禁：后端对任何密钥都返回失效；真实接入开通后此调用才会落库
    await pushDeviceModel({ apiKey: device.key.trim(), modelCode: device.modelCode })
    device.error = '采集失败：设备密钥错误或已失效'
  } catch (e) {
    device.error = e?.msg || '设备密钥错误或已失效，模型数据自动采集暂未开通'
  } finally {
    device.loading = false
  }
}

function reset() {
  rows.value = []
  bestMap.value = {}
  modelForms.value = []
  comboModels.value = []
  saving.value = false
  Object.assign(device, { visible: false, loading: false, key: '', error: '' })
}

defineExpose({ openForTask, openFree })
</script>

<style lang="scss" scoped>
.re-readonly { color: #303133; font-weight: 500; }
.re-item-box { width: 100%; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; max-height: 280px; overflow: auto; }
.re-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.re-table th { background: #f7f8fa; color: #606266; font-weight: 500; padding: 8px 10px; text-align: left; position: sticky; top: 0; }
.re-table td { padding: 7px 10px; border-top: 1px solid #f0f0f0; vertical-align: middle; }
.text-center { text-align: center; }
.col-name { min-width: 180px; }
.col-input { width: 180px; }
.re-code { font-family: ui-monospace, Menlo, monospace; color: #2563eb; margin-right: 8px; }
.re-name { color: #303133; }
.re-muted { color: #909399; }
.re-mono { font-family: ui-monospace, Menlo, monospace; }
.re-unit { display: inline-block; min-width: 34px; padding: 1px 8px; border-radius: 4px; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 500; }
.re-best-unit { margin-left: 4px; color: #94a3b8; font-size: 11px; }
.re-input-unit { color: #64748b; font-size: 12px; padding: 0 4px; white-space: nowrap; }
.re-empty { padding: 28px; text-align: center; color: #909399; font-size: 13px; }
.re-empty-sm { padding: 14px; }

/* 模型结构化卡片 */
.re-model-card { width: 100%; border: 1px solid #e9e4ff; border-radius: 8px; background: #fbfaff; padding: 12px; }
.re-model-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.re-model-name { font-weight: 600; color: #303133; font-size: 14px; margin-right: 8px; }
.re-model-code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #7c3aed; background: #f5f3ff; padding: 1px 8px; border-radius: 4px; }
.re-field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
.re-field-label { display: block; font-size: 12px; color: #475569; margin-bottom: 3px; }
.re-req { color: #f56c6c; margin-right: 2px; }
.re-field-key { font-family: ui-monospace, Menlo, monospace; color: #a5b4fc; font-size: 11px; margin-left: 6px; }
.re-derived { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e2dffb; font-size: 12px; color: #7c3aed; }
.re-derived-title { color: #94a3b8; margin-right: 6px; }
.re-derived-chip { display: inline-block; background: #f5f3ff; border-radius: 10px; padding: 1px 9px; margin: 0 6px 4px 0; }
.re-derived-chip i { font-style: normal; color: #a78bfa; margin-left: 2px; }
</style>
