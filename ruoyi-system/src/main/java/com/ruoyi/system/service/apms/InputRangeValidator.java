package com.ruoyi.system.service.apms;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruoyi.common.core.domain.entity.SysDictData;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.DictUtils;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;
import com.ruoyi.system.domain.apms.ApmsIndicator;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;
import com.ruoyi.system.mapper.apms.ApmsIndicatorMapper;
import com.ruoyi.system.service.ISysDictTypeService;

/**
 * 数值录入区间校验器（后端唯一不可绕过的硬限兜底）。
 *
 * <p>区间来自系统字典，管理员可在字典管理调整，无需改代码：
 * <ul>
 *   <li>{@code apms_measure_range}：体态测量字段（dict_value=height/weight/...）</li>
 *   <li>{@code apms_indicator_range}：成绩指标（dict_value=指标编码，未配置则不拦）</li>
 * </ul>
 * 每条字典的 remark 为 JSON：{@code {"hardMin":..,"hardMax":..,"warnMin":..,"warnMax":..}}。
 * 后端只执行 hard* 硬限（超出直接拒绝）；warn* 软区间是前端交互（弹确认框/标红），
 * 确认后允许入库，故后端不拦截。
 *
 * @author apms
 */
@Component
public class InputRangeValidator {

    private static final Logger log = LoggerFactory.getLogger(InputRangeValidator.class);

    /** 体态测量字段 → 中文名（与前端弹窗、字典标签口径一致） */
    private static final Map<String, String> BODY_LABELS = Map.of(
        "height", "身高",
        "weight", "体重",
        "sitHeight", "坐高",
        "bodyFatRate", "体脂率",
        "waist", "腰围"
    );

    private static final String DICT_BODY = "apms_measure_range";
    private static final String DICT_INDICATOR = "apms_indicator_range";

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired
    private ISysDictTypeService dictTypeService;

    @Autowired
    private ApmsIndicatorMapper indicatorMapper;

    /**
     * 体态测量硬限校验（upsert 入口统一调用，覆盖单条新增/编辑/周期批量/成绩同步）。
     * 空字段跳过（是否必填由业务规则保证）。
     */
    public void validateBody(ApmsBodyMeasure m) {
        if (m == null) return;
        Map<String, Range> ranges = loadRanges(DICT_BODY);
        check(ranges.get("height"), m.getHeight(), label("height"));
        check(ranges.get("weight"), m.getWeight(), label("weight"));
        check(ranges.get("sitHeight"), m.getSitHeight(), label("sitHeight"));
        check(ranges.get("bodyFatRate"), m.getBodyFatRate(), label("bodyFatRate"));
        check(ranges.get("waist"), m.getWaist(), label("waist"));
    }

    /**
     * INDICATOR 型成绩数值硬限校验。按 indicatorId 解析编码后查字典；
     * 指标不存在或未配置区间时不拦截（仅放过，数字格式由 BigDecimal 类型保证）。
     */
    public void validateIndicatorValues(Long indicatorId, List<ApmsTestResultValue> values) {
        if (indicatorId == null || values == null || values.isEmpty()) return;
        ApmsIndicator indicator = indicatorMapper.selectById(indicatorId);
        if (indicator == null || indicator.getCode() == null) return;
        Range range = loadRanges(DICT_INDICATOR).get(indicator.getCode());
        if (range == null) return;
        for (ApmsTestResultValue v : values) {
            // 派生字段是系统计算值，不参与录入校验
            if (v == null || v.getNumericValue() == null || "1".equals(v.getIsDerived())) continue;
            check(range, v.getNumericValue(), indicator.getName() != null ? indicator.getName() : indicator.getCode());
        }
    }

    private String label(String field) {
        return BODY_LABELS.getOrDefault(field, field);
    }

    private void check(Range range, BigDecimal value, String label) {
        if (range == null || value == null) return;
        boolean tooSmall = range.hardMin != null && value.compareTo(range.hardMin) < 0;
        boolean tooLarge = range.hardMax != null && value.compareTo(range.hardMax) > 0;
        if (tooSmall || tooLarge) {
            throw new ServiceException(label + " " + value.stripTrailingZeros().toPlainString()
                + " 超出允许范围（" + range.hardText() + "），请核对后重新录入");
        }
    }

    /** 读取字典并解析为 dict_value → Range；缓存未命中时回源查库（会回填缓存）。 */
    private Map<String, Range> loadRanges(String dictType) {
        List<SysDictData> list = DictUtils.getDictCache(dictType);
        if (list == null) {
            list = dictTypeService.selectDictDataByType(dictType);
        }
        Map<String, Range> map = new HashMap<>();
        if (list == null) return map;
        for (SysDictData d : list) {
            Range r = parseRange(d.getRemark());
            if (r != null) map.put(d.getDictValue(), r);
        }
        return map;
    }

    private Range parseRange(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode node = MAPPER.readTree(json);
            Range r = new Range();
            r.hardMin = decimal(node, "hardMin");
            r.hardMax = decimal(node, "hardMax");
            r.warnMin = decimal(node, "warnMin");
            r.warnMax = decimal(node, "warnMax");
            if (r.hardMin == null && r.hardMax == null) return null;
            return r;
        } catch (Exception e) {
            // 区间 JSON 配置错误不阻断业务，仅告警（按「无配置」处理）
            log.warn("录入区间字典 remark 不是合法 JSON，已忽略: {}", json, e);
            return null;
        }
    }

    private BigDecimal decimal(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.decimalValue();
    }

    /** 区间值对象（hard* 后端硬限，warn* 供前端软提示，后端不使用） */
    public static class Range {
        public BigDecimal hardMin;
        public BigDecimal hardMax;
        public BigDecimal warnMin;
        public BigDecimal warnMax;

        public String hardText() {
            return (hardMin == null ? "-∞" : hardMin.stripTrailingZeros().toPlainString())
                + " ~ " + (hardMax == null ? "+∞" : hardMax.stripTrailingZeros().toPlainString());
        }
    }
}
