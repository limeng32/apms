package com.ruoyi.system.mapper.apms;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.system.domain.apms.ApmsPhvRecord;

/**
 * PHV测量与计算记录 Mapper
 *
 * @author apms
 */
public interface ApmsPhvRecordMapper {

    /** 按ID查询 */
    ApmsPhvRecord selectById(Long id);

    /** 按运动员查询所有记录（measure_date DESC） */
    List<ApmsPhvRecord> selectByAthleteId(Long athleteId);

    /** 按运动员查询最新一条 */
    ApmsPhvRecord selectLatestByAthleteId(Long athleteId);

    /** 按运动员+source_measure_id 查询（用于判断是否已从该测量记录生成过 PHV） */
    ApmsPhvRecord selectBySourceMeasureId(@Param("athleteId") Long athleteId, @Param("sourceMeasureId") Long sourceMeasureId);

    /** 新增 */
    int insert(ApmsPhvRecord record);

    /** 按ID删除 */
    int deleteById(Long id);
}
