package com.ruoyi.system.service.apms.impl;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsIndicatorRefLevel;

/**
 * IndicatorRefLevel 区间校验
 *
 * <p>
 * 同一 ref 下多个 level 的区间规则：
 *   1. level 名称非空、长度 ≤ 32，枚举值大小写不敏感去重（DB 唯一键为 ci 排序规则）
 *   2. 边界允许为 null：min=null 表示负无穷，max=null 表示正无穷
 *      （界面支持「先建空档位、再逐档填区间」的配置流程；列注释亦如此约定）
 *   3. 上下限都填写时必须 min &lt; max
 *   4. 区间不得重叠：按 min 升序（null 视为 -∞）后仅需检查相邻档，
 *      且仅当「前一档上限、后一档下限」都已填写时才判定（与前端实时告警同口径，
 *      未配置完的开放档不阻断保存）
 *
 * <p>
 * 由 IndicatorRef / IndicatorRefLevel 的 Service 在保存前调用。
 *
 * @author apms
 */
@Service
public class IndicatorRefLevelValidator {

    /** level 名称最大长度（与 apms_indicator_ref_level.level varchar(32) 一致） */
    public static final int MAX_LEVEL_LENGTH = 32;

    /**
     * 校验同一 refId 下的所有 level
     *
     * @param levels 待校验的 level 列表
     * @throws ServiceException 校验失败（带具体错误描述，全局处理器直接返回前端）
     */
    public void validate(List<ApmsIndicatorRefLevel> levels) {
        if (levels == null || levels.isEmpty()) return;

        // 1. 非空 + 长度 + 大小写不敏感去重
        Set<String> levelSet = new HashSet<>();
        for (ApmsIndicatorRefLevel lv : levels) {
            String l = lv.getLevel();
            if (l == null || l.trim().isEmpty()) {
                throw new ServiceException("存在评级名称为空的条目");
            }
            l = l.trim();
            if (l.length() > MAX_LEVEL_LENGTH) {
                throw new ServiceException("评级名称 [" + l + "] 超过 " + MAX_LEVEL_LENGTH + " 个字符");
            }
            if (!levelSet.add(l.toUpperCase(Locale.ROOT))) {
                throw new ServiceException("评级枚举值重复：" + l + "（大小写不敏感）");
            }
        }

        // 2. 每个已填齐的 level 必须 min < max
        for (ApmsIndicatorRefLevel lv : levels) {
            BigDecimal min = lv.getMinValue();
            BigDecimal max = lv.getMaxValue();
            if (min != null && max != null && min.compareTo(max) >= 0) {
                throw new ServiceException(
                    String.format("评级 [%s] 的下限(%s) 必须小于上限(%s)", lv.getLevel(), min, max));
            }
        }

        // 3. 排序后检查相邻区间重叠（null 下限 = -∞ 排最前）
        List<ApmsIndicatorRefLevel> sorted = levels.stream()
            .sorted(Comparator.comparing(ApmsIndicatorRefLevel::getMinValue,
                Comparator.nullsFirst(Comparator.naturalOrder())))
            .collect(Collectors.toList());

        for (int i = 0; i < sorted.size() - 1; i++) {
            ApmsIndicatorRefLevel a = sorted.get(i);
            ApmsIndicatorRefLevel b = sorted.get(i + 1);
            // 任一侧仍是未填齐的开放/草稿档时，无法确定真实重叠，不阻断（前端给 warning）
            if (a.getMaxValue() == null || b.getMinValue() == null) continue;
            // 相邻：a.max > b.min 即重叠（相等端点为邻接，允许）
            if (a.getMaxValue().compareTo(b.getMinValue()) > 0) {
                throw new ServiceException(
                    String.format("评级 [%s](%s~%s) 与 [%s](%s~%s) 区间重叠",
                        a.getLevel(), bd(a.getMinValue()), bd(a.getMaxValue()),
                        b.getLevel(), bd(b.getMinValue()), bd(b.getMaxValue())));
            }
        }
    }

    private static String bd(BigDecimal v) {
        return v == null ? "∞" : v.toPlainString();
    }
}
