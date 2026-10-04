package com.ruoyi.system.mapper.apms;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;
import com.ruoyi.system.domain.apms.ApmsMeasureCycle;

public interface ApmsMeasureCycleMapper {
    List<ApmsMeasureCycle> selectList(ApmsMeasureCycle query);
    ApmsMeasureCycle selectById(Long id);
    int insert(ApmsMeasureCycle cycle);
    int update(ApmsMeasureCycle cycle);
    int deleteById(Long id);

    /** 删除周期前解链：周期内测量记录 cycle_id 置 NULL（数据保留） */
    int unlinkMeasures(@Param("cycleId") Long cycleId);

    /** 周期内已测队员的测量记录（按队员+周期，取每人最新一条） */
    List<ApmsBodyMeasure> selectMeasuredByCycle(@Param("cycleId") Long cycleId);

    /** 该队员在周期内是否已有记录 */
    ApmsBodyMeasure selectByCycleAndAthlete(@Param("cycleId") Long cycleId, @Param("athleteId") Long athleteId);
}
