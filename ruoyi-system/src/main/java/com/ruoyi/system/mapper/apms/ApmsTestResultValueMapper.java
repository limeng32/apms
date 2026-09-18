package com.ruoyi.system.mapper.apms;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;

/**
 * 测试结果值 Mapper
 */
public interface ApmsTestResultValueMapper {
    ApmsTestResultValue selectById(Long id);
    List<ApmsTestResultValue> selectByResultId(Long resultId);
    int insert(ApmsTestResultValue v);
    int update(ApmsTestResultValue v);
    int deleteById(Long id);
    int deleteByResultId(Long resultId);
    int batchInsert(List<ApmsTestResultValue> list);

    /**
     * 实时聚合同队/同年龄段/同指标的参考组统计量（用于 T-Score）
     *
     * @param params Map，键：teamId / ageGroup / indicatorId / gender（null 表示不筛）
     * @return Map 包含 count / avg_val / stddev_val；无数据时返回 count=0
     */
    Map<String, Object> selectAggregateStats(Map<String, Object> params);
}
