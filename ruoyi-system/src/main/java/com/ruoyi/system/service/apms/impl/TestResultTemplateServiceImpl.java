package com.ruoyi.system.service.apms.impl;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsIndicator;
import com.ruoyi.system.domain.apms.ApmsTaskItem;
import com.ruoyi.system.domain.apms.ApmsTaskMember;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsIndicatorMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskItemMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskMemberMapper;
import com.ruoyi.system.service.apms.ITestResultTemplateService;

/**
 * 测试结果 CSV 模板生成
 *
 * <p>结构（三行区）：
 * <ol>
 *   <li>中文说明行（首列以 # 开头，导入时自动跳过）：逐列标注中文名与单位，与表头一一对齐</li>
 *   <li>机器表头行：task_id?,athlete_id,athlete_name,measure_date,session_key + 指标/模型 code</li>
 *   <li>预填数据行：运动员 ID + 姓名已填，日期与成绩留空（无成绩的行导入时自动跳过）</li>
 * </ol>
 *
 * <p>通用模板：全部启用指标列 + 在训队员行；任务模板：首列 task_id（预填），
 * 数据列只含该任务配置的测试项，行预填参测队员。
 */
@Service
public class TestResultTemplateServiceImpl implements ITestResultTemplateService {

    @Autowired private ApmsIndicatorMapper indicatorMapper;
    @Autowired private ApmsTaskItemMapper taskItemMapper;
    @Autowired private ApmsTaskMemberMapper taskMemberMapper;
    @Autowired private ApmsAthleteMapper athleteMapper;

    @Override
    public String buildTemplateCsv(Long taskId) {
        boolean taskScoped = taskId != null;

        // 运动员 ID → 姓名（任务模板含已离队队员，故查全部而非仅在训）
        Map<Long, String> athleteNames = new HashMap<>();
        for (ApmsAthlete a : athleteMapper.selectApmsAthleteList(new ApmsAthlete())) {
            if (a.getAthleteId() != null) athleteNames.put(a.getAthleteId(), a.getName());
        }
        // 指标 code → 指标（取中文名与单位）
        Map<String, ApmsIndicator> indicatorByCode = new HashMap<>();
        ApmsIndicator iq = new ApmsIndicator();
        iq.setStatus("0");
        for (ApmsIndicator ind : indicatorMapper.selectList(iq)) {
            if (ind.getCode() != null) indicatorByCode.put(ind.getCode().toLowerCase(), ind);
        }

        // 固定列（表头 / 中文说明）
        List<String> headers = new ArrayList<>();
        List<String> guides = new ArrayList<>();
        if (taskScoped) {
            headers.add("task_id");
            guides.add("#任务ID（系统预填，勿改）");
            headers.add("athlete_id");
            guides.add("运动员ID（数字ID或姓名均可）");
        } else {
            headers.add("athlete_id");
            guides.add("#运动员ID（数字ID或姓名均可）");
        }
        headers.add("athlete_name");
        guides.add("运动员姓名（仅用于核对）");
        headers.add("measure_date");
        guides.add("测试日期(YYYY-MM-DD或YYYY/MM/DD)");
        headers.add("session_key");
        guides.add("场次（选填，如S1）");

        // 数据列 + 每行 {taskId?, athleteId}
        List<long[]> athleteRows = new ArrayList<>();
        if (taskScoped) {
            for (ApmsTaskItem item : taskItemMapper.selectByTaskId(taskId)) {
                if ("INDICATOR".equals(item.getItemType()) && item.getIndicatorCode() != null) {
                    headers.add(item.getIndicatorCode());
                    guides.add(indicatorGuide(item.getIndicatorCode(), item.getIndicatorName(), indicatorByCode));
                } else if ("MODEL".equals(item.getItemType()) && item.getModelCode() != null) {
                    headers.add(item.getModelCode());
                    // 测试模型无单位字段，仅标中文名
                    guides.add(csvCell(item.getModelName() != null ? item.getModelName() : item.getModelCode()));
                }
            }
            for (ApmsTaskMember m : taskMemberMapper.selectByTaskId(taskId)) {
                if (m.getAthleteId() != null) athleteRows.add(new long[]{taskId, m.getAthleteId()});
            }
        } else {
            for (ApmsIndicator ind : indicatorMapper.selectList(iq)) {
                if (ind.getCode() == null) continue;
                headers.add(ind.getCode());
                guides.add(indicatorGuide(ind.getCode(), ind.getName(), indicatorByCode));
            }
            ApmsAthlete aq = new ApmsAthlete();
            aq.setStatus("0");
            for (ApmsAthlete a : athleteMapper.selectApmsAthleteList(aq)) {
                athleteRows.add(new long[]{a.getAthleteId()});
            }
        }

        int dataColCount = headers.size() - (taskScoped ? 5 : 4);
        String emptyCells = dataColCount > 0
                ? "," + java.util.stream.IntStream.range(0, dataColCount).mapToObj(i -> "").collect(Collectors.joining(","))
                : "";

        StringBuilder sb = new StringBuilder();
        // 第 1 行：中文说明（首列以 # 开头，导入时整行跳过）
        sb.append(guides.stream().map(this::csvCell).collect(Collectors.joining(","))).append("\r\n");
        // 第 2 行：机器表头（code，请勿修改）
        sb.append(String.join(",", headers)).append("\r\n");
        // 第 3 行起：预填运动员，日期/成绩留空，导入时无成绩的行自动跳过
        for (long[] row : athleteRows) {
            List<String> cells = new ArrayList<>();
            int idx = 0;
            if (taskScoped) cells.add(String.valueOf(row[idx++]));
            long athleteId = row[idx];
            cells.add(String.valueOf(athleteId));
            cells.add(csvCell(athleteNames.getOrDefault(athleteId, "")));
            cells.add(""); // measure_date
            cells.add(""); // session_key
            sb.append(String.join(",", cells)).append(emptyCells).append("\r\n");
        }
        return sb.toString();
    }

    /** 指标列中文说明：中文名(单位)；查不到启用指标时退回 code */
    private String indicatorGuide(String code, String joinedName, Map<String, ApmsIndicator> indicatorByCode) {
        ApmsIndicator ind = indicatorByCode.get(code.toLowerCase());
        String name = ind != null && ind.getName() != null ? ind.getName()
                : (joinedName != null ? joinedName : code);
        String unit = ind != null ? ind.getUnit() : null;
        return csvCell(unit != null && !unit.isEmpty() ? name + "(" + unit + ")" : name);
    }

    /** CSV 单元格转义：含逗号/引号/换行时用双引号包裹 */
    private String csvCell(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
