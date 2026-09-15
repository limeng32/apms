package com.ruoyi.system.mapper.apms;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.system.domain.apms.ApmsIndicator;

/**
 * 指标库 Mapper
 */
public interface ApmsIndicatorMapper {

    public List<ApmsIndicator> selectList(ApmsIndicator indicator);

    public ApmsIndicator selectById(Long id);

    public int insert(ApmsIndicator indicator);

    public int update(ApmsIndicator indicator);

    public int deleteById(Long id);

    public int deleteByIds(Long[] ids);

    public ApmsIndicator selectByCode(String code);
}
