package com.ruoyi.system.service.apms.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;
import com.ruoyi.system.mapper.apms.ApmsBodyMeasureMapper;
import com.ruoyi.system.service.apms.IApmsBodyMeasureService;

/**
 * 体态测量 Service 实现
 *
 * @author apms
 */
@Service
public class ApmsBodyMeasureServiceImpl implements IApmsBodyMeasureService {

    @Autowired
    private ApmsBodyMeasureMapper measureMapper;

    @Override
    public List<ApmsBodyMeasure> list(ApmsBodyMeasure query) {
        return measureMapper.selectList(query);
    }

    @Override
    public ApmsBodyMeasure selectById(Long id) {
        return measureMapper.selectById(id);
    }

    @Override
    public List<ApmsBodyMeasure> selectByAthleteId(Long athleteId) {
        return measureMapper.selectByAthleteId(athleteId);
    }

    @Override
    public ApmsBodyMeasure selectLatestByAthleteId(Long athleteId) {
        return measureMapper.selectLatestByAthleteId(athleteId);
    }

    @Override
    public int upsert(ApmsBodyMeasure measure) {
        // 用唯一键查询是否已存在
        ApmsBodyMeasure existing = measureMapper.selectByUniqueKey(measure);
        if (existing != null) {
            // 更新已有记录
            measure.setId(existing.getId());
            return measureMapper.update(measure);
        } else {
            // 新增
            measure.setCreateBy(SecurityUtils.getUsername());
            return measureMapper.insert(measure);
        }
    }

    @Override
    public int deleteById(Long id) {
        return measureMapper.deleteById(id);
    }
}
