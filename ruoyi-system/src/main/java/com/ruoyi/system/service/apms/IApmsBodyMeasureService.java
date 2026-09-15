package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;

/**
 * 体态测量 Service 接口
 *
 * @author apms
 */
public interface IApmsBodyMeasureService {

    /** 按ID查询 */
    ApmsBodyMeasure selectById(Long id);

    /** 按运动员查询所有测量记录 */
    List<ApmsBodyMeasure> selectByAthleteId(Long athleteId);

    /** 按运动员查询最新一条 */
    ApmsBodyMeasure selectLatestByAthleteId(Long athleteId);

    /** 新增或更新（upsert 模式：唯一键为 athlete_id + measure_date + source_task_id + source_session_key） */
    int upsert(ApmsBodyMeasure measure);

    /** 按ID删除 */
    int deleteById(Long id);
}
