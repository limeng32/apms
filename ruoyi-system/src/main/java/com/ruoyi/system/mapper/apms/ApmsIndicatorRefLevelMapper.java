package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsIndicatorRefLevel;

/**
 * 指标参考范围三级判定 Mapper
 */
public interface ApmsIndicatorRefLevelMapper {

    public List<ApmsIndicatorRefLevel> selectByRefId(Long refId);

    public ApmsIndicatorRefLevel selectById(Long id);

    public int insert(ApmsIndicatorRefLevel level);

    public int update(ApmsIndicatorRefLevel level);

    public int deleteById(Long id);

    public int deleteByRefId(Long refId);
}
