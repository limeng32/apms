package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTestResultRep;
import com.ruoyi.system.domain.apms.ApmsIndicatorRefLevel;

/**
 * 测试结果 REP 评价 Mapper
 */
public interface ApmsTestResultRepMapper {
    List<ApmsTestResultRep> selectByResultId(Long resultId);
    int insert(ApmsTestResultRep rep);
    int deleteByResultId(Long resultId);
    int batchInsert(List<ApmsTestResultRep> list);

    /** 根据 indicator_id + gender + age_group 查 ref_level（Service 算 REP 用） */
    List<ApmsIndicatorRefLevel> selectRefLevels(Long indicatorId, String gender, String ageGroup);
}
