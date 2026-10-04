<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page tt-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">测试任务</h1>
          <p class="rk-subtitle">
            {{ stats.total }} 个任务 · {{ stats.members }} 人次参测 · 平均完成率 {{ stats.avgProgress }}%
          </p>
        </div>
        <div class="rk-header-actions">
          <el-button class="rk-btn rk-btn-primary" @click="handleAdd" v-hasPermi="['apms:testTask:add']">
            <el-icon><Plus /></el-icon>新增任务
          </el-button>
          <el-button class="rk-btn rk-btn-danger" :disabled="multiple" @click="handleDelete()" v-hasPermi="['apms:testTask:remove']">
            <el-icon><Delete /></el-icon>删除
          </el-button>
        </div>
      </div>

      <!-- ===== KPI 卡带（额外只读全量请求统计，零后端改动） ===== -->
      <div class="rk-kpi-grid is-4">
        <div class="rk-kpi-card" v-for="k in kpiCards" :key="k.label">
          <span class="rk-kpi-accent" :style="{ background: k.accent }"></span>
          <div class="rk-kpi-label">{{ k.label }}</div>
          <div class="rk-kpi-value">{{ k.value }}<span class="rk-kpi-unit" v-if="k.unit">{{ k.unit }}</span></div>
          <span class="rk-kpi-chip" :class="k.chipTone">{{ k.chip }}</span>
        </div>
      </div>

      <!-- ===== 筛选（原生控件） ===== -->
      <div class="rk-filter">
        <label class="rk-group">
          <span class="rk-label">任务名称</span>
          <input v-model="queryParams.taskName" class="rk-input" placeholder="搜索任务名称" @keyup.enter="handleQuery"/>
        </label>
        <label class="rk-group">
          <span class="rk-label">状态</span>
          <select v-model="queryParams.status" class="rk-select tt-select-status">
            <option :value="null">全部状态</option>
            <option value="pending">未开始</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
          </select>
        </label>
        <div class="rk-filter-right">
          <button type="button" class="rk-btn-reset" @click="resetQuery">
            <el-icon><RefreshLeft /></el-icon>重置
          </button>
        </div>
      </div>

      <!-- ===== 主从双栏 ===== -->
      <div class="rk-split-grid" style="--rk-split-l: 13.2fr; --rk-split-r: 10.8fr;">

        <!-- 左：任务列表（服务端分页） -->
        <div class="rk-table-card">
          <div class="rk-card-head">
            <h3 class="rk-card-title">测试任务</h3>
            <span class="rk-card-sub">共 {{ total }} 个 · 点击行查看详情</span>
          </div>
          <div class="rk-card-body flush">
            <div v-loading="loading" class="rk-table-scroll">
              <table class="rk-table tt-table is-compact">
                <thead>
                  <tr>
                    <th class="col-check"></th>
                    <th>任务名称</th>
                    <th class="col-dept">队伍</th>
                    <th class="text-center col-date">时间</th>
                    <th class="text-center col-status">状态</th>
                    <th class="col-progress">进度</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in taskList" :key="row.id"
                      class="rk-row"
                      :class="{ 'is-selected': currentTask && currentTask.id === row.id }"
                      @click="handleRowClick(row)">
                    <td class="col-check" @click.stop>
                      <input type="checkbox" class="rk-check" :checked="ids.includes(row.id)"
                             @change="toggleRow(row)"/>
                    </td>
                    <td>
                      <div class="tt-task-name">{{ row.taskName }}</div>
                      <div class="tt-task-id rk-mono">#{{ row.id }} · 主测 {{ row.testerName || '—' }}</div>
                    </td>
                    <td class="tt-dept">{{ row.targetDeptName || '—' }}</td>
                    <td class="text-center">
                      <div class="tt-date rk-mono">{{ formatDate(row.startDate) }} ~ {{ formatDate(row.endDate) }}</div>
                    </td>
                    <td class="text-center">
                      <span class="rk-status-badge" :class="statusTone(row.status)">{{ statusLabel(row.status) }}</span>
                    </td>
                    <td>
                      <div class="tt-progress-cell">
                        <div class="rk-progress"><div class="rk-progress-bar" :class="progressTone(row.progressPercent)" :style="{ width: (row.progressPercent || 0) + '%' }"></div></div>
                        <span class="tt-progress-num rk-mono">{{ row.progressPercent || 0 }}%</span>
                      </div>
                      <button type="button" class="rk-link tt-edit-link" @click.stop="handleEdit(row)" v-hasPermi="['apms:testTask:edit']">编辑</button>
                    </td>
                  </tr>
                  <tr v-if="!loading && taskList.length === 0">
                    <td colspan="6" class="rk-empty-cell">
                      <div class="rk-empty">
                        <p class="rk-empty-title">暂无测试任务</p>
                        <p class="rk-empty-desc">点击右上角「新增任务」创建</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="rk-pager" v-if="total > 0">
              <span class="rk-pager-info">
                共 <b class="rk-mono">{{ total }}</b> 个 · 第 <span class="rk-mono">{{ queryParams.pageNum }}</span> / {{ totalPages }} 页
              </span>
              <div class="rk-pager-btns">
                <button type="button" class="rk-page-btn" :disabled="queryParams.pageNum <= 1" @click="goPage(queryParams.pageNum - 1)">
                  <el-icon><ArrowLeft /></el-icon>
                </button>
                <template v-for="p in pageNumbers" :key="p">
                  <span v-if="p === '…'" class="rk-page-btn is-ellipsis rk-mono">…</span>
                  <button v-else type="button" class="rk-page-btn rk-mono"
                          :class="{ 'is-active': p === queryParams.pageNum }"
                          @click="goPage(p)">{{ p }}</button>
                </template>
                <button type="button" class="rk-page-btn" :disabled="queryParams.pageNum >= totalPages" @click="goPage(queryParams.pageNum + 1)">
                  <el-icon><ArrowRight /></el-icon>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 右：任务详情 -->
        <div class="rk-card tt-detail-card">
          <template v-if="currentTask">
            <div class="tt-detail-banner" :class="'banner-' + (currentTask.status || 'pending')">
              <div class="tt-banner-top">
                <span class="rk-status-badge" :class="statusTone(currentTask.status)">{{ statusLabel(currentTask.status) }}</span>
                <span class="tt-banner-pct rk-mono">{{ currentTask.progressPercent || 0 }}%</span>
              </div>
              <div class="tt-banner-title">{{ currentTask.taskName }}</div>
              <div class="tt-banner-meta">
                <span>{{ currentTask.targetDeptName || '未指定队伍' }}</span>
                <span class="rk-mono">{{ currentTask.startDate || '—' }} ~ {{ currentTask.endDate || '—' }}</span>
                <span>主测：{{ currentTask.testerName || '—' }}</span>
              </div>
            </div>

            <div class="rk-card-body" v-loading="detailLoading">

              <!-- 5 格摘要 -->
              <div class="tt-summary">
                <div class="tt-sum-item">
                  <div class="tt-sum-num rk-mono">{{ detail.items.length }}</div>
                  <div class="tt-sum-label">测试项</div>
                </div>
                <div class="tt-sum-item">
                  <div class="tt-sum-num rk-mono">{{ currentTask.memberTotal || 0 }}</div>
                  <div class="tt-sum-label">参测队员</div>
                </div>
                <div class="tt-sum-item is-ok">
                  <div class="tt-sum-num rk-mono">{{ currentTask.memberCompleted || 0 }}</div>
                  <div class="tt-sum-label">已完成</div>
                </div>
                <div class="tt-sum-item is-warn">
                  <div class="tt-sum-num rk-mono">{{ currentTask.memberPartial || 0 }}</div>
                  <div class="tt-sum-label">部分完成</div>
                </div>
                <div class="tt-sum-item is-gray">
                  <div class="tt-sum-num rk-mono">{{ currentTask.memberPending || 0 }}</div>
                  <div class="tt-sum-label">未开始</div>
                </div>
              </div>

              <!-- 原生 Tabs -->
              <div class="rk-tabs tt-tabs">
                <button type="button" class="rk-tab" :class="{ 'is-active': activeTab === 'items' }" @click="activeTab = 'items'">
                  测试项 <span class="tt-tab-count rk-mono">{{ detail.items.length }}</span>
                </button>
                <button type="button" class="rk-tab" :class="{ 'is-active': activeTab === 'members' }" @click="activeTab = 'members'">
                  参测队员 <span class="tt-tab-count rk-mono">{{ detail.members.length }}</span>
                </button>
              </div>

              <!-- Tab 1：测试项 -->
              <div v-show="activeTab === 'items'" class="rk-tab-panel">
                <div class="rk-toolbar">
                  <el-button class="rk-btn rk-btn-primary rk-btn-sm" :disabled="!currentTask" @click="openItemDialog()">
                    <el-icon><Plus /></el-icon>添加测试项
                  </el-button>
                  <el-button class="rk-btn rk-btn-sm" :disabled="!currentTask" @click="loadDetail(currentTask.id)">
                    <el-icon><Refresh /></el-icon>刷新
                  </el-button>
                  <span class="tt-toolbar-hint">从指标库或测试模型库选择，加入本任务</span>
                </div>
                <div v-if="detail.items.length" class="rk-table-scroll tt-inner-scroll">
                  <table class="rk-table tt-inner-table">
                    <thead>
                      <tr>
                        <th class="text-center col-idx">#</th>
                        <th class="text-center col-type">类型</th>
                        <th>名称</th>
                        <th class="text-center col-dir">方向</th>
                        <th class="text-center col-req">必/选</th>
                        <th class="text-center col-sort">排序</th>
                        <th class="text-center col-ops">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(it, idx) in detail.items" :key="it.id" class="rk-row" :class="{ 'is-zebra': idx % 2 === 1 }">
                        <td class="text-center rk-mono">{{ idx + 1 }}</td>
                        <td class="text-center">
                          <span class="rk-soft-chip" :class="it.itemType === 'INDICATOR' ? 'is-indicator' : 'is-model'">
                            {{ it.itemType === 'INDICATOR' ? '指标' : '模型' }}
                          </span>
                        </td>
                        <td>
                          <template v-if="it.itemType === 'INDICATOR'">
                            <span class="tt-item-code rk-mono">{{ it.indicatorCode }}</span>
                            <span class="tt-item-name">{{ it.indicatorName }}</span>
                          </template>
                          <template v-else>
                            <span class="tt-item-code rk-mono">{{ it.modelCode }}</span>
                            <span class="tt-item-name">{{ it.modelName }}</span>
                            <span class="tt-model-cat">{{ it.modelCategory }}</span>
                          </template>
                        </td>
                        <td class="text-center">
                          <span v-if="it.itemType === 'INDICATOR'" class="tt-dir" :class="dirClass(it.indicatorDirection)">{{ dirLabel(it.indicatorDirection) }}</span>
                          <span v-else class="rk-dash">—</span>
                        </td>
                        <td class="text-center">
                          <span class="rk-status-badge" :class="it.isRequired === '1' ? 'tone-red' : 'tone-gray'">
                            {{ it.isRequired === '1' ? '必测' : '选测' }}
                          </span>
                        </td>
                        <td class="text-center rk-mono">{{ it.sortOrder }}</td>
                        <td class="text-center">
                          <button type="button" class="rk-link" @click="openItemDialog(it)">改</button>
                          <button type="button" class="rk-link tt-link-danger" @click="handleDeleteItem(it)">删</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="tt-inner-empty">暂无测试项 — 点击上方按钮添加</div>
              </div>

              <!-- Tab 2：参测队员 -->
              <div v-show="activeTab === 'members'" class="rk-tab-panel">
                <div class="rk-toolbar">
                  <el-button class="rk-btn rk-btn-primary rk-btn-sm" :disabled="!currentTask" @click="openEnrollDialog()">
                    <el-icon><Plus /></el-icon>单个登记
                  </el-button>
                  <el-button class="rk-btn rk-btn-primary rk-btn-sm" :disabled="!currentTask" @click="openBatchEnrollDialog()">
                    <el-icon><User /></el-icon>批量登记
                  </el-button>
                  <el-button class="rk-btn rk-btn-sm" :disabled="!currentTask" @click="loadDetail(currentTask.id)">
                    <el-icon><Refresh /></el-icon>刷新
                  </el-button>
                  <span class="tt-toolbar-hint">目标队伍：{{ currentTask.targetDeptName || currentTask.targetDeptId || '—' }}</span>
                </div>
                <div v-if="detail.members.length" class="rk-table-scroll tt-inner-scroll">
                  <table class="rk-table tt-inner-table">
                    <thead>
                      <tr>
                        <th class="col-mname">姓名</th>
                        <th class="text-center col-gender">性别</th>
                        <th>队伍</th>
                        <th class="text-center col-mstatus">状态</th>
                        <th class="text-center col-mops">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(m, idx) in detail.members" :key="m.athleteId" class="rk-row" :class="{ 'is-zebra': idx % 2 === 1 }">
                        <td class="tt-mname">{{ m.athleteName }}</td>
                        <td class="text-center">
                          <span class="tr-gender" :class="m.athleteGender === 'F' ? 'is-f' : 'is-m'">{{ m.athleteGender === 'F' ? '♀' : '♂' }}</span>
                        </td>
                        <td class="tt-mteam">{{ m.athleteTeam || '—' }}</td>
                        <td class="text-center">
                          <span class="rk-status-badge" :class="memberStatusTone(m.status)">{{ memberStatusLabel(m.status) }}</span>
                        </td>
                        <td class="text-center">
                          <button type="button" class="rk-link"
                                  v-hasPermi="['apms:testResult:add']"
                                  @click="openEntryForMember(m)">录成绩</button>
                          <button type="button" class="rk-link" @click="openQuickChangeStatus(m)">改状态</button>
                          <button type="button" class="rk-link tt-link-danger" @click="handleRemoveMember(m)">离队</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="tt-inner-empty">暂无参测队员 — 点击上方按钮登记</div>
              </div>
            </div>
          </template>

          <div v-else class="tt-detail-empty">
            <div class="rk-empty">
              <p class="rk-empty-title">选择左侧任务查看详情</p>
              <p class="rk-empty-desc">测试项配置、参测队员与完成进度将在此展示</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 任务 新增/编辑 Dialog（原逻辑保留） ========== -->
      <el-dialog :title="dialogTitle" v-model="showTaskDialog" width="520px">
        <el-form ref="taskFormRef" :model="taskForm" :rules="taskRules" label-width="100px">
          <el-row :gutter="12">
            <el-col :span="24">
              <el-form-item label="任务名称" prop="taskName">
                <el-input v-model="taskForm.taskName" placeholder="如 U18 秋季体能测试"/>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="目标队伍" prop="targetDeptId">
                <el-tree-select v-model="taskForm.targetDeptId" :data="deptOptions" :render-after-expand="false"
                  :props="{ label: 'label', value: 'id', children: 'children', disabled: 'disabled' }"
                  expand-on-click-node filterable popper-class="tt-dept-popper"
                  placeholder="仅可选择末级队伍（灰色分组不可选）" style="width:100%"/>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="主测人" prop="testerId">
                <el-select v-model="taskForm.testerId" placeholder="选择主测人" style="width:100%">
                  <el-option v-for="u in userOptions" :key="u.userId" :label="u.nickName" :value="u.userId"/>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="开始日期">
                <el-date-picker v-model="taskForm.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%"/>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="结束日期">
                <el-date-picker v-model="taskForm.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%"/>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="状态">
                <el-select v-model="taskForm.status" style="width:100%">
                  <el-option label="未开始" value="pending"/>
                  <el-option label="进行中" value="in_progress"/>
                  <el-option label="已完成" value="completed"/>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
        <template #footer>
          <el-button @click="showTaskDialog = false">取 消</el-button>
          <el-button type="primary" @click="submitTask">保 存</el-button>
        </template>
      </el-dialog>

      <!-- ========== 成员状态快速变更 ========== -->
      <el-dialog title="更新参测状态" v-model="showStatusDialog" width="360px">
        <el-form label-width="90px">
          <el-form-item label="运动员">
            <span>{{ currentMember?.athleteName }}</span>
          </el-form-item>
          <el-form-item label="新状态">
            <el-radio-group v-model="memberStatus">
              <el-radio value="pending">未开始</el-radio>
              <el-radio value="partial">部分完成</el-radio>
              <el-radio value="completed">全部完成</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showStatusDialog = false">取 消</el-button>
          <el-button type="primary" @click="submitStatus">保 存</el-button>
        </template>
      </el-dialog>

      <!-- ========== 添加/编辑 测试项 ========== -->
      <el-dialog :title="itemForm.id ? '编辑测试项' : '添加测试项'" v-model="showItemDialog" width="480px">
        <el-form :model="itemForm" label-width="100px">
          <el-form-item label="类型">
            <el-radio-group v-model="itemForm.itemType">
              <el-radio value="INDICATOR">指标</el-radio>
              <el-radio value="MODEL">测试模型</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="选择" v-if="itemForm.itemType === 'INDICATOR'">
            <el-select v-model="itemForm.indicatorId" filterable placeholder="选择指标" style="width:100%">
              <el-option v-for="i in indicatorOptions" :key="i.id" :label="i.code + ' · ' + i.name" :value="i.id">
                <span>{{ i.code }}</span>
                <span style="float:right;color:#8492a6;font-size:13px">{{ i.name }} · {{ i.category }}</span>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="选择" v-else>
            <el-select v-model="itemForm.modelId" filterable placeholder="选择测试模型" style="width:100%">
              <el-option v-for="m in modelOptions" :key="m.id" :label="m.code + ' · ' + m.name" :value="m.id">
                <span>{{ m.code }}</span>
                <span style="float:right;color:#8492a6;font-size:13px">{{ m.name }} · {{ m.category }}</span>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="必/选测">
            <el-switch v-model="itemForm.isRequiredBool" active-value="1" inactive-value="0"/>
            <span style="margin-left:8px;color:#909399;font-size:12px">{{ itemForm.isRequiredBool === '1' ? '必测（所有队员必须完成）' : '选测' }}</span>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="itemForm.sortOrder" :min="1" :step="1"/>
          </el-form-item>
          <el-form-item label="方向覆盖" v-if="itemForm.itemType === 'INDICATOR'">
            <el-select v-model="itemForm.directionOverride" clearable placeholder="跟随指标默认方向" style="width:100%">
              <el-option label="↑ 越大越好 (HIGHER_BETTER)" value="HIGHER_BETTER"/>
              <el-option label="↓ 越小越好 (LOWER_BETTER)" value="LOWER_BETTER"/>
              <el-option label="≈ 范围最佳 (RANGE_BEST)" value="RANGE_BEST"/>
              <el-option label="— 仅参考 (REFERENCE_ONLY)" value="REFERENCE_ONLY"/>
            </el-select>
            <div class="form-tip">不选则使用指标库默认方向</div>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showItemDialog = false">取 消</el-button>
          <el-button type="primary" @click="submitItem">保 存</el-button>
        </template>
      </el-dialog>

      <!-- ========== 单个登记 ========== -->
      <el-dialog title="登记参测队员" v-model="showEnrollDialog" width="400px">
        <el-form label-width="90px">
          <el-form-item label="运动员">
            <el-select v-model="enrollAthleteId" filterable placeholder="搜索队员" style="width:100%">
              <el-option v-for="a in athleteOptions" :key="a.athleteId" :label="a.name + ' (' + a.gender + ')'" :value="a.athleteId">
                <span>{{ a.name }}</span>
                <span style="float:right;color:#8492a6;font-size:12px">{{ a.gender }} · {{ a.primaryTeamId }}</span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showEnrollDialog = false">取 消</el-button>
          <el-button type="primary" @click="submitEnroll">登 记</el-button>
        </template>
      </el-dialog>

      <!-- ========== 批量登记 ========== -->
      <el-dialog title="批量登记参测队员" v-model="showBatchEnrollDialog" width="520px">
        <el-alert v-if="currentTask?.targetDeptId" :closable="false" type="info" show-icon
          :title="'只显示目标队伍 ' + currentTask.targetDeptId + ' 的队员（其他队伍也可手动选）'"
          style="margin-bottom:12px"/>
        <el-select v-model="batchAthleteIds" multiple filterable placeholder="选择多名队员" style="width:100%"
          :loading="athleteLoading">
          <el-option v-for="a in athleteOptions" :key="a.athleteId" :label="a.name + ' (' + a.gender + ')' + ' #' + a.athleteId" :value="a.athleteId">
            <span>{{ a.name }}</span>
            <span style="float:right;color:#8492a6;font-size:12px">{{ a.gender }} · team={{ a.primaryTeamId }}</span>
          </el-option>
        </el-select>
        <div class="form-tip">已选 {{ batchAthleteIds.length }} 人 · 已在名单中的队员会自动跳过（幂等）</div>
        <template #footer>
          <el-button @click="showBatchEnrollDialog = false">取 消</el-button>
          <el-button type="primary" @click="submitBatchEnroll">批量登记</el-button>
        </template>
      </el-dialog>

      <!-- 成绩录入 -->
      <result-entry-dialog ref="entryDialogRef" @success="handleEntrySuccess"/>
    </div>
  </div>
</template>

<script setup name="ApmsTestTask">
import { listTestTask, getTestTask, addTestTask, updateTestTask, delTestTask,
         updateMemberStatus, listTaskItem, addTaskItem, updateTaskItem, delTaskItem,
         listTaskMember, enrollMember, batchEnroll, removeMember } from '@/api/apms/testTask'
import { listDept } from '@/api/system/dept'
import { listUser } from '@/api/system/user'
import request from '@/utils/request'
import { Plus, Delete, RefreshLeft, Refresh, ArrowLeft, ArrowRight, User } from '@element-plus/icons-vue'
import ResultEntryDialog from '@/components/ResultEntryDialog/index.vue'

const { proxy } = getCurrentInstance()

const PAGE_SIZE = 10

// ========= 查询 =========
const loading = ref(false)
const taskList = ref([])
const total = ref(0)
const ids = ref([])
const multiple = ref(true)
const queryParams = reactive({ pageNum: 1, pageSize: PAGE_SIZE, taskName: null, status: null })

function getList() {
  loading.value = true
  listTestTask(queryParams).then(res => {
    taskList.value = res.rows || []
    total.value = res.total || 0
  }).finally(() => { loading.value = false })
}
function handleQuery() { queryParams.pageNum = 1; getList() }

let filterGuard = false
function resetQuery() {
  filterGuard = true
  queryParams.taskName = null
  queryParams.status = null
  queryParams.pageNum = 1
  getList()
  nextTick(() => { filterGuard = false })
}
let filterTimer = null
watch(() => [queryParams.taskName, queryParams.status], () => {
  if (filterGuard) return
  clearTimeout(filterTimer)
  filterTimer = setTimeout(handleQuery, 300)
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pageNumbers = computed(() => {
  const pages = totalPages.value, cur = queryParams.pageNum
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const start = Math.max(2, Math.min(pages - 4, cur - 2))
  const nums = [1]
  for (let i = start; i < Math.min(pages, start + 3); i++) nums.push(i)
  nums.push(pages)
  return nums
})
function goPage(p) {
  if (p === '…' || p < 1 || p > totalPages.value || p === queryParams.pageNum) return
  queryParams.pageNum = p
  getList()
}

function toggleRow(row) {
  const i = ids.value.indexOf(row.id)
  if (i >= 0) ids.value.splice(i, 1); else ids.value.push(row.id)
  multiple.value = !ids.value.length
}

// ========= KPI 统计（只读全量一次，不新增后端接口） =========
const stats = reactive({ total: 0, inProgress: 0, pending: 0, completed: 0, members: 0, depts: 0, avgProgress: 0 })
let statsSeq = 0
function loadStats() {
  const seq = ++statsSeq
  listTestTask({ pageNum: 1, pageSize: 500 }).then(r => {
    if (seq !== statsSeq) return
    const rows = r.rows || []
    stats.total = r.total || 0
    stats.inProgress = rows.filter(x => x.status === 'in_progress').length
    stats.pending = rows.filter(x => x.status === 'pending').length
    stats.completed = rows.filter(x => x.status === 'completed').length
    stats.members = rows.reduce((s, x) => s + (x.memberTotal || 0), 0)
    stats.depts = new Set(rows.map(x => x.targetDeptId).filter(Boolean)).size
    stats.avgProgress = rows.length ? Math.round(rows.reduce((s, x) => s + (x.progressPercent || 0), 0) / rows.length) : 0
  })
}
const kpiCards = computed(() => [
  { label: '测试任务总数', value: stats.total, unit: '个', accent: '#2563EB', chip: '按 DataScope 隔离', chipTone: 'tone-info' },
  { label: '进行中', value: stats.inProgress, unit: '个', accent: '#D97706', chip: '未开始 ' + stats.pending + ' · 已完成 ' + stats.completed, chipTone: 'tone-warn' },
  { label: '参测人次', value: stats.members, unit: '人次', accent: '#06B6D4', chip: '覆盖 ' + stats.depts + ' 支目标队伍', chipTone: '' },
  { label: '平均完成率', value: stats.avgProgress, unit: '%', accent: '#16A34A', chip: '按任务进度均值', chipTone: 'tone-ok' }
])

// ========= 主从 =========
const currentTask = ref(null)
const detail = reactive({ items: [], members: [] })
const detailLoading = ref(false)
const activeTab = ref('items')

function handleRowClick(row) {
  currentTask.value = row
  activeTab.value = 'items'
  loadDetail(row.id)
}
function loadDetail(id) {
  detailLoading.value = true
  getTestTask(id).then(res => {
    const d = res.data
    Object.assign(detail, { items: d.items || [], members: d.members || [] })
    currentTask.value = d
  }).finally(() => { detailLoading.value = false })
}

// ========= 辅助下拉 =========
const deptOptions = ref([])
const parentDeptIds = ref(new Set())  // 有下级的部门（非叶子），禁选
const userOptions = ref([])
const indicatorOptions = ref([])
const modelOptions = ref([])
const athleteOptions = ref([])
const athleteLoading = ref(false)

function loadAuxData() {
  listDept({ pageNum: 1, pageSize: 500 }).then(res => {
    const rows = res.data || []
    // 目标队伍只允许选择叶子部门：构建部门树，有 children 的节点标记 disabled
    const flat = rows.map(d => ({ id: d.deptId, label: d.deptName, parentId: d.parentId }))
    const tree = proxy.handleTree(flat, 'id', 'parentId', 'children') || []
    const parents = new Set()
    const markDisabled = nodes => nodes.forEach(n => {
      if (n.children && n.children.length) {
        parents.add(n.id)
        n.disabled = true
        markDisabled(n.children)
      }
    })
    markDisabled(tree)
    parentDeptIds.value = parents
    deptOptions.value = tree
  })
  listUser({ pageNum: 1, pageSize: 100 }).then(res => {
    userOptions.value = res.rows || []
  })
  // 指标下拉（选测试项时用）
  request({ url: '/apms/indicator/list', method: 'get', params: { pageSize: 500 } }).then(r => {
    indicatorOptions.value = r.rows || r.data || []
  })
  // 测试模型下拉
  request({ url: '/apms/test-model/list', method: 'get', params: { pageSize: 500 } }).then(r => {
    modelOptions.value = r.rows || r.data || []
  })
  // 运动员下拉（登记队员时用）
  athleteLoading.value = true
  request({ url: '/apms/athlete/list', method: 'get', params: { pageSize: 500, status: '0' } }).then(r => {
    athleteOptions.value = r.rows || r.data || []
    athleteLoading.value = false
  }).catch(() => { athleteLoading.value = false })
}

// ========= Task Dialog =========
const showTaskDialog = ref(false)
const taskFormRef = ref(null)
const dialogTitle = ref('')
const taskForm = reactive({ id: null, taskName: '', targetDeptId: null, testerId: null, startDate: null, endDate: null, status: 'pending' })
const taskRules = {
  taskName: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  targetDeptId: [{ required: true, message: '请选择目标队伍', trigger: 'change' }],
  testerId: [{ required: true, message: '请选择主测人', trigger: 'change' }]
}

function handleAdd() {
  dialogTitle.value = '新增测试任务'
  Object.assign(taskForm, { id: null, taskName: '', targetDeptId: null, testerId: null, startDate: null, endDate: null, status: 'pending' })
  loadAuxData(); showTaskDialog.value = true
}
function handleEdit(row) {
  dialogTitle.value = '编辑测试任务'
  Object.assign(taskForm, row)
  loadAuxData(); showTaskDialog.value = true
}
function submitTask() {
  proxy.$refs.taskFormRef.validate(valid => {
    if (!valid) return
    if (parentDeptIds.value.has(taskForm.targetDeptId)) {
      return proxy.$modal.msgWarning('目标队伍只能选择末级队伍（含下级的部门为分组，不可选）')
    }
    const req = taskForm.id ? updateTestTask(taskForm) : addTestTask(taskForm)
    req.then(() => {
      proxy.$modal.msgSuccess('保存成功'); showTaskDialog.value = false; getList(); loadStats()
      if (currentTask.value?.id === taskForm.id) loadDetail(currentTask.value.id)
    })
  })
}
function handleDelete(row) {
  const selIds = row ? row.id : ids.value
  proxy.$modal.confirm('确认删除？其下测试项和成员将一并删除。').then(() => delTestTask(selIds))
    .then(() => {
      proxy.$modal.msgSuccess('删除成功'); getList(); loadStats()
      ids.value = []; multiple.value = true
      if (currentTask.value && (Array.isArray(selIds) ? selIds.includes(currentTask.value.id) : selIds === currentTask.value.id)) {
        currentTask.value = null; detail.items = []; detail.members = []
      }
    }).catch(() => {})
}

// ========= 成员状态快速变更 =========
const showStatusDialog = ref(false)
const currentMember = ref(null)
const memberStatus = ref('pending')
function openQuickChangeStatus(m) {
  currentMember.value = m; memberStatus.value = m.status; showStatusDialog.value = true
}
function submitStatus() {
  updateMemberStatus({ taskId: currentTask.value.id, athleteId: currentMember.value.athleteId, status: memberStatus.value }).then(() => {
    proxy.$modal.msgSuccess('状态已更新'); showStatusDialog.value = false
    loadDetail(currentTask.value.id); getList(); loadStats()  // 刷新进度
  })
}

// ========= 测试项 CRUD =========
const showItemDialog = ref(false)
const itemForm = reactive({
  id: null, taskId: null, itemType: 'INDICATOR',
  indicatorId: null, modelId: null,
  isRequiredBool: '0', directionOverride: null, sortOrder: 1
})

function openItemDialog(row) {
  if (!currentTask.value) return
  // 先确保下拉数据已加载
  if (indicatorOptions.value.length === 0 || modelOptions.value.length === 0) loadAuxData()

  const nextSort = detail.items.length + 1
  if (row) {
    // 编辑
    Object.assign(itemForm, {
      id: row.id,
      taskId: row.taskId || currentTask.value.id,
      itemType: row.itemType,
      indicatorId: row.indicatorId || null,
      modelId: row.modelId || null,
      isRequiredBool: row.isRequired || '0',
      directionOverride: row.directionOverride || null,
      sortOrder: row.sortOrder || nextSort
    })
  } else {
    // 新增 — 默认 itemType=INDICATOR，自动取下一个 sortOrder
    Object.assign(itemForm, {
      id: null, taskId: currentTask.value.id,
      itemType: 'INDICATOR', indicatorId: null, modelId: null,
      isRequiredBool: '0', directionOverride: null, sortOrder: nextSort
    })
  }
  showItemDialog.value = true
}
function submitItem() {
  if (itemForm.itemType === 'INDICATOR' && !itemForm.indicatorId) return proxy.$modal.msgWarning('请选择指标')
  if (itemForm.itemType === 'MODEL' && !itemForm.modelId) return proxy.$modal.msgWarning('请选择测试模型')

  const payload = {
    id: itemForm.id,
    taskId: itemForm.taskId,
    itemType: itemForm.itemType,
    indicatorId: itemForm.itemType === 'INDICATOR' ? itemForm.indicatorId : null,
    modelId: itemForm.itemType === 'MODEL' ? itemForm.modelId : null,
    isRequired: itemForm.isRequiredBool,
    directionOverride: itemForm.directionOverride || null,
    sortOrder: itemForm.sortOrder
  }
  const req = payload.id ? updateTaskItem(payload) : addTaskItem(payload)
  req.then(() => {
    proxy.$modal.msgSuccess('保存成功'); showItemDialog.value = false
    loadDetail(currentTask.value.id); getList(); loadStats()
  })
}
function handleDeleteItem(row) {
  proxy.$modal.confirm(`确认删除测试项 "${row.indicatorName || row.modelName}"？`).then(() => {
    return delTaskItem(row.id)
  }).then(() => {
    proxy.$modal.msgSuccess('已删除')
    loadDetail(currentTask.value.id); getList(); loadStats()
  }).catch(() => {})
}

// ========= 成员登记 =========
const showEnrollDialog = ref(false)
const enrollAthleteId = ref(null)
const showBatchEnrollDialog = ref(false)
const batchAthleteIds = ref([])

function openEnrollDialog() {
  if (athleteOptions.value.length === 0) loadAuxData()
  enrollAthleteId.value = null
  showEnrollDialog.value = true
}
function submitEnroll() {
  if (!enrollAthleteId.value) return proxy.$modal.msgWarning('请选择队员')
  enrollMember({ taskId: currentTask.value.id, athleteId: enrollAthleteId.value }).then(() => {
    proxy.$modal.msgSuccess('登记成功'); showEnrollDialog.value = false
    loadDetail(currentTask.value.id); getList(); loadStats()
  }).catch(e => {
    // 400 "already enrolled" 类错误友好提示
    const msg = e?.message || e?.response?.data?.msg || '登记失败'
    proxy.$modal.msgWarning(msg)
  })
}

function openBatchEnrollDialog() {
  if (athleteOptions.value.length === 0) loadAuxData()
  // 预填已登记成员（让用户直观看到）；批量接口幂等，重复项自动跳过
  batchAthleteIds.value = detail.members.map(m => m.athleteId)
  showBatchEnrollDialog.value = true
}
function submitBatchEnroll() {
  if (batchAthleteIds.value.length === 0) return proxy.$modal.msgWarning('请选择至少 1 名队员')
  batchEnroll(currentTask.value.id, batchAthleteIds.value).then(res => {
    const msg = res?.msg || `已登记 ${batchAthleteIds.value.length} 人`
    proxy.$modal.msgSuccess(msg); showBatchEnrollDialog.value = false
    loadDetail(currentTask.value.id); getList(); loadStats()
  })
}

function handleRemoveMember(row) {
  proxy.$modal.confirm(`确认将 ${row.athleteName} 移出本任务？`).then(() => {
    return removeMember(currentTask.value.id, row.athleteId)
  }).then(() => {
    proxy.$modal.msgSuccess('已移出')
    loadDetail(currentTask.value.id); getList(); loadStats()
  }).catch(() => {})
}

// ========= 成绩录入 =========
const entryDialogRef = ref(null)

function openEntryForMember(m) {
  entryDialogRef.value?.openForTask({
    taskId: currentTask.value.id,
    taskName: currentTask.value.taskName,
    athleteId: m.athleteId,
    athleteName: m.athleteName
  })
}
function handleEntrySuccess() {
  loadDetail(currentTask.value.id); getList(); loadStats()
}

// ========= 辅助 =========
function statusLabel(s) { return { pending: '未开始', in_progress: '进行中', completed: '已完成' }[s] || s }
function statusTone(s) { return ({ pending: 'tone-gray', in_progress: 'tone-amber', completed: 'tone-green' })[s] || 'tone-gray' }
function memberStatusLabel(s) { return { pending: '未开始', partial: '部分完成', completed: '全部完成' }[s] || s }
function memberStatusTone(s) { return ({ pending: 'tone-gray', partial: 'tone-amber', completed: 'tone-green' })[s] || 'tone-gray' }
function dirLabel(d) { return ({ HIGHER_BETTER: '↑越大越好', LOWER_BETTER: '↓越小越好', RANGE_BEST: '≈范围', REFERENCE_ONLY: '—仅参考' })[d] || d }
function dirClass(d) { return ({ HIGHER_BETTER: 'higher', LOWER_BETTER: 'lower' })[d] || '' }
function progressTone(p) { return (p >= 100) ? 'tone-ok' : (p >= 50 ? '' : 'tone-warn') }
function formatDate(d) { if (!d) return '—'; return String(d).substring(5, 10) }

getList()
loadStats()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.tt-select-status { width: 130px; }
.rk-empty-cell { padding: 36px 0; }

/* 左表 */
.tt-table tbody tr { cursor: pointer; }
.col-dept { width: 96px; }
.col-date { width: 118px; }
.col-status { width: 84px; }
.col-progress { width: 150px; }
.tt-task-name { font-size: 13px; font-weight: 600; color: $rk-text-1; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tt-task-id { font-size: 11px; color: $rk-text-3; margin-top: 2px; }
.tt-dept { font-size: 12px; color: $rk-text-2; }
.tt-date { font-size: 11px; color: $rk-text-2; white-space: nowrap; }
.tt-progress-cell { display: flex; align-items: center; gap: 8px; }
/* flex 容器内轨道需显式占满剩余空间，否则宽度坍缩为 min-content，进度条只剩一小截 */
.tt-progress-cell .rk-progress { flex: 1; min-width: 120px; }
.tt-progress-num { font-size: 11px; font-weight: 600; color: $rk-text-2; min-width: 34px; }
.tt-edit-link { margin-top: 4px; font-size: 12px; }

:deep(.rk-soft-chip.is-indicator) { background: $rk-brand-50; color: $rk-brand-600; }
:deep(.rk-soft-chip.is-model) { background: #e8f7ee; color: $rk-ok; }

/* 右详情 */
.tt-detail-card { overflow: hidden; }
.tt-detail-empty { padding: 80px 20px; }
.tt-detail-banner {
  padding: 16px 18px 15px;
  border-bottom: 1px solid $rk-line;
  background: linear-gradient(180deg, #f4f7ff, #fff 88%);
  &.banner-completed { background: linear-gradient(180deg, #effaf2, #fff 88%); }
  &.banner-pending { background: linear-gradient(180deg, #f8fafc, #fff 88%); }
}
.tt-banner-top { display: flex; align-items: center; justify-content: space-between; }
.tt-banner-pct { font-size: 13px; font-weight: 700; color: $rk-text-2; }
.tt-banner-title { margin-top: 8px; font-size: 16px; font-weight: 700; color: $rk-text-1; }
.tt-banner-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 5px; font-size: 12px; color: $rk-text-3; }

/* 摘要条 */
.tt-summary {
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
  border: 1px solid $rk-line; border-radius: 12px; overflow: hidden;
}
.tt-sum-item {
  padding: 12px 8px; text-align: center;
  border-right: 1px solid $rk-line;
  background: #fff;
  &:last-child { border-right: none; }
}
.tt-sum-num { font-size: 22px; font-weight: 700; color: $rk-text-1; line-height: 1.2; }
.tt-sum-label { font-size: 11px; color: $rk-text-3; margin-top: 2px; }
.tt-sum-item.is-ok .tt-sum-num { color: $rk-ok; }
.tt-sum-item.is-warn .tt-sum-num { color: $rk-warn; }
.tt-sum-item.is-gray .tt-sum-num { color: #94a3b8; }

/* Tabs */
.tt-tabs { margin-top: 18px; }
.tt-tab-count {
  display: inline-block; min-width: 18px; padding: 0 5px; margin-left: 4px;
  font-size: 11px; font-weight: 600; line-height: 17px; text-align: center;
  color: $rk-text-3; background: #f1f5f9; border-radius: 999px;
}
.rk-tab.is-active .tt-tab-count { background: $rk-brand-50; color: $rk-brand-600; }

.tt-toolbar-hint { margin-left: auto; font-size: 12px; color: $rk-text-3; }
.tt-inner-scroll { border: 1px solid $rk-line; border-radius: 12px; }
.tt-inner-table { font-size: 13px; }
.tt-inner-empty {
  padding: 26px; text-align: center; font-size: 12px; color: $rk-text-3;
  background: #f8fafc; border: 1px dashed $rk-line; border-radius: 12px;
}

.col-idx { width: 40px; }
.col-type { width: 64px; }
.col-dir { width: 110px; }
.col-req { width: 70px; }
.col-sort { width: 56px; }
.col-ops { width: 90px; }
.tt-item-code { font-size: 12px; font-weight: 600; color: $rk-brand-600; margin-right: 6px; }
.tt-item-name { font-size: 13px; color: $rk-text-1; }
.tt-model-cat {
  margin-left: 6px; padding: 0 7px; font-size: 11px; color: $rk-text-3;
  background: #f1f5f9; border-radius: 999px;
}
.tt-dir {
  font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px;
  &.higher { background: #e8f7ee; color: $rk-ok; }
  &.lower { background: #fef3e0; color: $rk-warn; }
}
.tt-link-danger { color: $rk-risk; }

.col-mname { width: 110px; }
.col-gender { width: 56px; }
.col-mstatus { width: 100px; }
.col-mops { width: 130px; }
.tt-mname { font-size: 13px; font-weight: 600; color: $rk-text-1; }
.tt-mteam { font-size: 12px; color: $rk-text-2; }

.tr-gender {
  display: inline-flex; align-items: center; justify-content: center;
  width: 17px; height: 17px; border-radius: 50%;
  font-size: 11px; font-weight: 700; line-height: 1;
  &.is-m { background: #eff5ff; color: #2563eb; }
  &.is-f { background: #fdeef1; color: #dc2626; }
}

.form-tip { margin-top: 4px; font-size: 12px; color: #909399; line-height: 1.4; }

@media (max-width: 1400px) {
  .tt-summary { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}
/* 手机端：5 列摘要（每列不足 60px）改 2 列，末项跨满整行 */
@media (max-width: 640px) {
  .tt-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tt-sum-item:nth-child(2n) { border-right: none; }
  .tt-sum-item:nth-child(3),
  .tt-sum-item:nth-child(5) { border-top: 1px solid $rk-line; }
  .tt-sum-item:nth-child(5) { grid-column: 1 / -1; }
}
</style>

<!-- 非 scoped：目标队伍下拉面板 teleport 到 body，只能靠 popper-class 命中 -->
<style lang="scss">
/* 分组部门虽不可选中，但点整行可展开/收起，统一显示手型。
   注意：标签文字实际是内部 .el-select-dropdown__item.is-disabled，
   EP 对它单独设了 not-allowed，必须覆盖到该内层元素 */
.tt-dept-popper .el-tree-node__content,
.tt-dept-popper .el-select-dropdown__item,
.tt-dept-popper .el-select-dropdown__item.is-disabled {
  cursor: pointer !important;
}
</style>
