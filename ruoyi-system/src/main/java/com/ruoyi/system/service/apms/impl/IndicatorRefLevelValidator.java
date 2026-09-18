package com.ruoyi.system.service.apms.impl;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import com.ruoyi.common.exception.IndicatorRefInvalidException;
import com.ruoyi.system.domain.apms.ApmsIndicatorRefLevel;

/**
 * IndicatorRefLevel 区间校验
 *
 * <p>
 * 同一 ref 下多个 level 的区间必须满足：
 *   1. 互不重叠（两两检查 min/max 是否有交集）
 *   2. min < max（合法区间）
 *   3. level 枚举值不能重复
 *
 * <p>
 * 由 IndicatorRef / IndicatorRefLevel 的 Service 或 Controller 在保存前调用。
 *
 * @author apms
 */
@Service
public class IndicatorRefLevelValidator {

    /**
     * 校验同一 refId 下的所有 level
     *
     * @param levels 待校验的 level 列表
     * @throws IndicatorRefInvalidException 如果校验失败（带具体错误描述）
     */
    public void validate(List<ApmsIndicatorRefLevel> levels) {
        if (levels == null || levels.isEmpty()) return;

        // 1. 枚举值去重
        Set<String> levelSet = new HashSet<>();
        for (ApmsIndicatorRefLevel lv : levels) {
            String l = lv.getLevel();
            if (l == null || l.isEmpty()) {
                throw new IndicatorRefInvalidException("存在 level 为空的条目");
            }
            if (!levelSet.add(l)) {
                throw new IndicatorRefInvalidException("level 枚举值重复：" + l);
            }
        }

        // 2. 每个 level 的 min < max
        for (ApmsIndicatorRefLevel lv : levels) {
            if (lv.getMinValue() == null || lv.getMaxValue() == null) {
                throw new IndicatorRefInvalidException(
                    String.format("level=%s 的 minValue 或 maxValue 为 null", lv.getLevel()));
            }
            if (lv.getMinValue().compareTo(lv.getMaxValue()) >= 0) {
                throw new IndicatorRefInvalidException(
                    String.format("level=%s 的 minValue(%.4f) >= maxValue(%.4f)，区间无效",
                        lv.getLevel(), lv.getMinValue(), lv.getMaxValue()));
            }
        }

        // 3. 两两检查区间是否重叠
        for (int i = 0; i < levels.size(); i++) {
            ApmsIndicatorRefLevel a = levels.get(i);
            for (int j = i + 1; j < levels.size(); j++) {
                ApmsIndicatorRefLevel b = levels.get(j);
                // [a.min, a.max] 和 [b.min, b.max] 是否有交集
                // 条件：a.min < b.max 且 b.min < a.max
                if (a.getMinValue().compareTo(b.getMaxValue()) < 0
                        && b.getMinValue().compareTo(a.getMaxValue()) < 0) {
                    throw new IndicatorRefInvalidException(
                        String.format("level=%s(%.4f~%.4f) 与 level=%s(%.4f~%.4f) 区间重叠",
                            a.getLevel(), a.getMinValue(), a.getMaxValue(),
                            b.getLevel(), b.getMinValue(), b.getMaxValue()));
                }
            }
        }

        // 4. 检查是否有零长度 gap（可选警告，不拦截）
        // 排序后看相邻区间是否有 gap
        List<ApmsIndicatorRefLevel> sorted = levels.stream()
            .sorted(Comparator.comparing(ApmsIndicatorRefLevel::getMinValue))
            .collect(Collectors.toList());

        for (int i = 0; i < sorted.size() - 1; i++) {
            BigDecimal curMax = sorted.get(i).getMaxValue();
            BigDecimal nextMin = sorted.get(i + 1).getMinValue();
            // gap：nextMin > curMax + ε
            BigDecimal gap = nextMin.subtract(curMax);
            if (gap.compareTo(new BigDecimal("0.0001")) > 0) {
                // 非致命，只记录到 Service.log — 这里不抛异常
                // 生产环境可以通过日志提醒用户补齐中间区间
            }
        }
    }
}
