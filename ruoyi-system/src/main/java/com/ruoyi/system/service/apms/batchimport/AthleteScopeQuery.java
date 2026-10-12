package com.ruoyi.system.service.apms.batchimport;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;

/**
 * 批量导入：带数据权限的运动员精确查询。
 *
 * <p>独立成 bean 的原因：@DataScope 基于 Spring AOP 代理，同类内部自调用不生效，
 * 必须由 AthleteImportResolver 跨 bean 调用本类方法，切面才会把 scope SQL
 * 写入 ApmsAthlete.params.dataScope（对应 mapper XML 中的占位符）。
 *
 * @author apms
 */
@Component
public class AthleteScopeQuery {

    @Autowired
    private ApmsAthleteMapper athleteMapper;

    /**
     * 按 athleteId 精确 或 name 精确等值查询当前数据权限内的运动员。
     * admin 超管切面自动跳过；其他角色按角色 data_scope 过滤主属队伍。
     */
    @DataScope(deptAlias = "a", deptField = "primary_team_id")
    public List<ApmsAthlete> findScoped(ApmsAthlete query) {
        return athleteMapper.selectImportCandidates(query);
    }
}
