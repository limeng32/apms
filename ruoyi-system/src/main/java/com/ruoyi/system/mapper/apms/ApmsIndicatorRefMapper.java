package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsIndicatorRef;

/**
 * 指标参考范围 Mapper
 */
public interface ApmsIndicatorRefMapper {

    public List<ApmsIndicatorRef> selectByIndicatorId(Long indicatorId);

    public ApmsIndicatorRef selectById(Long id);

    public int insert(ApmsIndicatorRef ref);

    public int update(ApmsIndicatorRef ref);

    public int deleteById(Long id);

    public int deleteByIndicatorId(Long indicatorId);
}
