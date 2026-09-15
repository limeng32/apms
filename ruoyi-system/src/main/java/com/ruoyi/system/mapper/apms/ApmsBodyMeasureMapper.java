package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;

/**
 * 体态测量 Mapper
 *
 * @author apms
 */
public interface ApmsBodyMeasureMapper {

    /** 按ID查询 */
    ApmsBodyMeasure selectById(Long id);

    /** 按运动员查询所有测量记录（measure_date DESC） */
    List<ApmsBodyMeasure> selectByAthleteId(Long athleteId);

    /** 按运动员查询最新一条 */
    ApmsBodyMeasure selectLatestByAthleteId(Long athleteId);

    /** 按 athlete_id + measure_date + source_task_id + source_session_key 查询（upsert 条件） */
    ApmsBodyMeasure selectByUniqueKey(ApmsBodyMeasure measure);

    /** 新增 */
    int insert(ApmsBodyMeasure measure);

    /** 修改 */
    int update(ApmsBodyMeasure measure);

    /** 按ID删除 */
    int deleteById(Long id);
}
