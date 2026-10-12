package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;

/**
 * 体态测量 Service 接口
 *
 * @author apms
 */
public interface IApmsBodyMeasureService {

    /** 全局列表 */
    List<ApmsBodyMeasure> list(ApmsBodyMeasure query);

    /** 按ID查询 */
    ApmsBodyMeasure selectById(Long id);

    /** 按运动员查询所有测量记录 */
    List<ApmsBodyMeasure> selectByAthleteId(Long athleteId);

    /** 按运动员查询最新一条 */
    ApmsBodyMeasure selectLatestByAthleteId(Long athleteId);

    /** 新增或更新（upsert 模式：唯一键为 athlete_id + measure_date + source_task_id + source_session_key） */
    int upsert(ApmsBodyMeasure measure);

    /**
     * 批量导入新增：dataSource='import'、无任务/周期来源。
     * 写前重查同队员同日期冲突（任何来源已存在即抛 ServiceException），成功后触发 PHV/KR 重算。
     */
    int importInsert(ApmsBodyMeasure measure);

    /**
     * 批量导入覆盖：仅更新五个数值列，且仅限 data_source='import' 的记录。
     * 影响行数 0（记录不存在/来源已被改为其他来源）抛 ServiceException；成功后触发 PHV/KR 重算。
     */
    int importUpdateImported(Long id, ApmsBodyMeasure measure);

    /** 按ID删除 */
    int deleteById(Long id);
}
