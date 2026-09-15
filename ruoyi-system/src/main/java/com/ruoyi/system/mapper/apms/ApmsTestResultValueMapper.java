package com.ruoyi.system.mapper.apms;

import java.util.List;
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
}
