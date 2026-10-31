package com.ruoyi.system.service.apms.assistant;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import com.ruoyi.system.domain.apms.assistant.AssistantAction;
import com.ruoyi.system.domain.apms.assistant.AssistantChatRequest;
import com.ruoyi.system.domain.apms.assistant.AssistantContext;
import com.ruoyi.system.domain.apms.assistant.AssistantPrincipal;
import com.ruoyi.system.domain.apms.assistant.AssistantReply;

/**
 * M1 伪 RPA 规则引擎：关键词意图 + 固定模板 + 导航动作。
 *
 * <p>严格一致原则：只有“目标页默认可见且与问题操作完全一致”的按钮才带 highlightKey。
 * 子页签/选中行/抽屉内的操作只导航，并在回答中写明页签或下一步。
 */
@Service
public class PseudoAssistantProvider implements AssistantProvider
{
    private static final String PATH_ROSTER = "/athletes/roster";
    private static final String PATH_GROWTH = "/athletes/growth";
    private static final String PATH_DISPATCH = "/testings/dispatch";
    private static final String PATH_COMBO = "/testings/combo-dispatch";
    private static final String PATH_HEALTH = "/healthcare/alert-center";
    private static final String PATH_REPORT = "/analytics/report-center";

    private final List<Intent> intents = buildIntents();

    @Override
    public AssistantReply reply(AssistantChatRequest request, AssistantPrincipal principal)
    {
        String question = request.getMessage() == null ? "" : request.getMessage().trim();
        String lower = question.toLowerCase();

        Intent best = null;
        int bestScore = 0;
        for (Intent intent : intents)
        {
            int score = intent.score(lower);
            if (score > bestScore)
            {
                bestScore = score;
                best = intent;
            }
        }

        if (best == null)
        {
            return fallback(question, principal);
        }

        String answer = best.answer;
        if ("PAGE_HELP".equals(best.code))
        {
            answer = pageHelp(request.getContext());
        }

        AssistantAction action = null;
        if (best.path != null && principal.getAllowedPaths().contains(best.path))
        {
            action = new AssistantAction();
            action.setType("navigate");
            action.setPath(best.path);
            action.setLabel(best.label);
            if (best.highlightKey != null && principal.hasPermission(best.highlightPerm))
            {
                action.setHighlightKey(best.highlightKey);
                action.setRequiresPerm(Collections.singletonList(best.highlightPerm));
                action.setDurationMs(3000);
            }
        }
        return new AssistantReply(best.code, answer, action);
    }

    private AssistantReply fallback(String question, AssistantPrincipal principal)
    {
        StringBuilder sb = new StringBuilder();
        sb.append("我可以帮你快速定位系统功能。你可以试试：\n");
        for (String s : principal.getSuggestions())
        {
            sb.append("· ").append(s).append("\n");
        }
        sb.append("\n如果问题涉及具体数据，请到对应业务页面查看。");
        return new AssistantReply("FALLBACK", sb.toString(), null);
    }

    private String pageHelp(AssistantContext context)
    {
        String route = context == null || context.getRoute() == null ? "" : context.getRoute();
        Map<String, String> helps = new LinkedHashMap<>();
        helps.put("/overview/cockpit", "这是数据驾驶舱：查看在队人数、任务进度、RTP 分布、PHV 分布与健康预警。");
        helps.put("/athletes/roster", "这是花名册：可筛选队伍/状态，查看运动员详情；右上角可新建运动员档案。");
        helps.put("/athletes/growth", "这是青训发育监控：上半区体态测量，下半区 PHV 成熟度计算与趋势。");
        helps.put("/testings/dispatch", "这里是指标库与任务下发：分「指标库 / 测试任务 / 测试结果」三个页签，导入成绩需切到「测试结果」。");
        helps.put("/testings/combo-dispatch", "这里是组合测试调度：分「测试模型 / 组合模型 / 评分记录」三个页签，批量计算需切到「评分记录」。");
        helps.put("/healthcare/alert-center", "这里是健康预警中心：上半区 RTP 状态看板（可拖拽卡片更新），下半区风险预警待办与处置。");
        helps.put("/healthcare/medical-care", "这里是医疗康复：左侧医疗记录列表，右侧详情与附件下载。");
        helps.put("/analytics/report-center", "这里是报告中心：先筛选/选中报告，右侧详情可下载 PDF；右上角可生成新报告。");
        String help = helps.get(route);
        if (help == null)
        {
            help = "当前页面的功能可从页面标题与页签判断；你也可以问我“怎么新增运动员”“怎么导入成绩”等问题。";
        }
        return help;
    }

    private List<Intent> buildIntents()
    {
        List<Intent> list = new ArrayList<>();
        list.add(new Intent("ATHLETE_CREATE",
                new String[] { "新增运动员", "新建运动员", "建档", "添加运动员", "录入运动员" },
                "1. 进入「花名册」，点击右上角「新建运动员档案」。\n"
                        + "2. 填写姓名、性别、出生日期、主队伍等必填信息。\n"
                        + "3. 新建运动员不会自动生成 RTP 状态，需要队医后续评估。",
                PATH_ROSTER, "athlete-add", "apms:athlete:add", "打开花名册并定位新建按钮"));
        list.add(new Intent("PHV_HOW",
                new String[] { "phv", "生长发育", "成熟度", "成年身高", "预测身高", "mirwald" },
                "1. 进入「青训发育监控」，上半区先录入体态测量（身高、坐高、体重）。\n"
                        + "2. 下半区打开 PHV 计算弹窗，可选择体态记录或直接输入参数。\n"
                        + "3. 计算会保存输入快照与算法版本；成年身高由体态保存后自动推导。",
                PATH_GROWTH, null, null, "打开青训发育监控"));
        list.add(new Intent("IMPORT_RESULT",
                new String[] { "导入成绩", "成绩导入", "批量导入", "体测导入", "导入体测",
                        "导入测试", "测试成绩", "体测", "导入", "csv", "excel", "xlsx" },
                "1. 进入「指标库与任务下发」，切换到「测试结果」页签。\n"
                        + "2. 点击右上角「批量导入」，先上传文件预览校验，再确认入库。\n"
                        + "3. 同队员同日已有记录、或来源冲突时，系统会拒绝导入而不是静默覆盖。",
                PATH_DISPATCH, null, null, "打开指标库与任务下发"));
        list.add(new Intent("COMBO_SCORE",
                new String[] { "组合评分", "组合分", "组合模型", "加权", "t分", "t-score" },
                "1. 进入「组合测试调度」，切换到「评分记录」页签。\n"
                        + "2. 点击右上角「批量计算」，选择组合模型与测试任务。\n"
                        + "3. 计算会写入参考统计量快照；样本不足 5 时使用参考区间代理口径，可复核。",
                PATH_COMBO, null, null, "打开组合测试调度"));
        list.add(new Intent("RTP_EDIT",
                new String[] { "rtp", "参训状态", "红黄绿", "评估处置", "复训", "康复状态" },
                "1. 进入「健康预警中心」上半区的 RTP 状态看板。\n"
                        + "2. 拖动卡片到目标状态列会弹出确认；也可以打开卡片抽屉后使用评估处置。\n"
                        + "3. 修改必须填写原因与训练限制，系统会写入变更日志；只有具备 apms:rtp:edit 的账号可操作。",
                PATH_HEALTH, null, null, "打开健康预警中心"));
        list.add(new Intent("REPORT_GENERATE",
                new String[] { "生成报告", "报告生成", "新建报告", "重新生成报告" },
                "1. 进入「报告中心」，点击右上角「生成新报告」。\n"
                        + "2. 选择报告类型（单人 / 任务 / 队伍）并填写对应对象。\n"
                        + "3. 生成后会写入内容快照与 PDF，可在右侧详情下载。",
                PATH_REPORT, null, null, "打开报告中心"));
        list.add(new Intent("REPORT_DOWNLOAD",
                new String[] { "报告下载", "下载报告", "pdf下载", "下载pdf", "导出报告",
                        "报告在哪", "在哪下载", "报告", "下载" },
                "1. 进入「报告中心」，在左侧列表筛选并选中一条报告。\n"
                        + "2. 右侧详情会显示文件状态；文件已生成时点击「下载 PDF 报告」。\n"
                        + "3. 若显示未生成或文件被清理，可先「生成新报告」或重新生成。",
                PATH_REPORT, null, null, "打开报告中心"));
        list.add(new Intent("PAGE_HELP",
                new String[] { "当前页面", "这个页面", "本页", "页面能做什么", "这里能做什么" },
                "", null, null, null, "当前页面说明"));
        list.add(new Intent("CAPABILITY",
                new String[] { "你能做什么", "能干什么", "帮助", "怎么用你", "使用说明" },
                "我可以回答系统页面与操作流程问题，并把你带到正确页面。当前支持：\n"
                        + "· 新建运动员、PHV 计算、成绩导入、组合评分、RTP 状态、报告下载\n"
                        + "· 页面导航与页面功能说明\n"
                        + "我不会自动提交表单，也不会执行删除、导出等写操作。",
                null, null, null, null));
        return list;
    }

    private static class Intent
    {
        private final String code;
        private final List<String> keywords;
        private final String answer;
        private final String path;
        private final String highlightKey;
        private final String highlightPerm;
        private final String label;

        Intent(String code, String[] keywords, String answer, String path,
               String highlightKey, String highlightPerm, String label)
        {
            this.code = code;
            this.keywords = Arrays.asList(keywords);
            this.answer = answer;
            this.path = path;
            this.highlightKey = highlightKey;
            this.highlightPerm = highlightPerm;
            this.label = label;
        }

        int score(String lowerQuestion)
        {
            int score = 0;
            for (String kw : keywords)
            {
                if (lowerQuestion.contains(kw.toLowerCase()))
                {
                    // 长关键词优先，降低泛词误命中
                    score += kw.length();
                }
            }
            return score;
        }
    }
}
