package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;

/**
 * 体态测量 Mapper
 *
 * @author apms
 */
public interface ApmsBodyMeasureMapper {

    /** 全局列表（JOIN athlete + dept，可选 deptId/athleteId 过滤） */
    List<ApmsBodyMeasure> selectList(ApmsBodyMeasure query);

    /** 按ID查询 */
    ApmsBodyMeasure selectById(Long id);

    /** 按运动员查询所有测量记录（measure_date DESC） */
    List<ApmsBodyMeasure> selectByAthleteId(Long athleteId);

    /** 按运动员查询最新一条 */
    ApmsBodyMeasure selectLatestByAthleteId(Long athleteId);

    /** 按 athlete_id + measure_date + source_task_id + source_session_key 查询（upsert 条件） */
    ApmsBodyMeasure selectByUniqueKey(ApmsBodyMeasure measure);

    /**
     * 批量导入冲突检查：同队员同日期的任意来源记录（不限 source），按 id 倒序。
     * 入参只需 athleteId + measureDate。
     */
    List<ApmsBodyMeasure> selectConflictOnDate(ApmsBodyMeasure query);

    /** 新增 */
    int insert(ApmsBodyMeasure measure);

    /** 修改 */
    int update(ApmsBodyMeasure measure);

    /**
     * 批量导入专用：仅更新五个数值列，且仅限 data_source='import' 的记录。
     * 不触碰日期、来源、任务/周期归属、创建信息；返回影响行数（0=来源已变，拒绝覆盖）。
     */
    int updateImportedValues(ApmsBodyMeasure measure);

    /** 按ID删除 */
    int deleteById(Long id);
}
