package com.ruoyi.system.mapper.apms;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.system.domain.apms.ApmsAthletePromotionLog;

/**
 * 赛季晋升记录 Mapper
 *
 * @author apms
 */
public interface ApmsAthletePromotionLogMapper {

    /** 批量写入晋升记录 */
    int batchInsert(@Param("list") List<ApmsAthletePromotionLog> list);
}
