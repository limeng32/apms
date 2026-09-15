package com.ruoyi.system.service.apms.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsTestTask;
import com.ruoyi.system.domain.apms.ApmsTaskItem;
import com.ruoyi.system.domain.apms.ApmsTaskMember;
import com.ruoyi.system.mapper.apms.ApmsTestTaskMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskItemMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskMemberMapper;
import com.ruoyi.system.service.apms.IApmsTestTaskService;

@Service
public class ApmsTestTaskServiceImpl implements IApmsTestTaskService {

    @Autowired
    private ApmsTestTaskMapper taskMapper;
    @Autowired
    private ApmsTaskItemMapper itemMapper;
    @Autowired
    private ApmsTaskMemberMapper memberMapper;

    // ==================== Task CRUD ====================

    @Override
    public List<ApmsTestTask> selectList(ApmsTestTask task) {
        List<ApmsTestTask> list = taskMapper.selectList(task);
        // 列表也填充进度（避免前端逐条查）
        for (ApmsTestTask t : list) fillProgress(t);
        return list;
    }

    @Override
    public ApmsTestTask getDetail(Long id) {
        ApmsTestTask t = taskMapper.selectById(id);
        if (t == null) return null;
        fillProgress(t);
        t.setItems(itemMapper.selectByTaskId(id));
        t.setMembers(memberMapper.selectByTaskId(id));
        return t;
    }

    @Override
    public int insert(ApmsTestTask task) {
        if (task.getStatus() == null) task.setStatus("pending");
        return taskMapper.insert(task);
    }

    @Override
    public int update(ApmsTestTask task) {
        return taskMapper.update(task);
    }

    @Override
    @Transactional
    public int deleteByIds(Long[] ids) {
        for (Long id : ids) {
            memberMapper.deleteByTaskId(id);
            itemMapper.deleteByTaskId(id);
            taskMapper.deleteByIds(new Long[]{id});
        }
        return ids.length;
    }

    // ==================== Task Progress ====================

    @Override
    public void fillProgress(ApmsTestTask task) {
        int total = memberMapper.countByTaskAndStatus(task.getId(), "pending")
                  + memberMapper.countByTaskAndStatus(task.getId(), "partial")
                  + memberMapper.countByTaskAndStatus(task.getId(), "completed");
        int completed = memberMapper.countByTaskAndStatus(task.getId(), "completed");
        int partial   = memberMapper.countByTaskAndStatus(task.getId(), "partial");
        int pending   = memberMapper.countByTaskAndStatus(task.getId(), "pending");

        task.setMemberTotal(total);
        task.setMemberCompleted(completed);
        task.setMemberPartial(partial);
        task.setMemberPending(pending);

        if (total > 0) {
            // partial 算 50%，completed 算 100%
            int pct = (int) Math.round((completed * 100.0 + partial * 50.0) / total);
            task.setProgressPercent(pct);
        } else {
            task.setProgressPercent(0);
        }
    }

    @Override
    public void recalculateMemberStatus(Long taskId, Long athleteId) {
        // P3 结果录入时实现：根据该运动员在该 task 下的 item 完成情况更新 status
        // 此处留空 stub
    }

    // ==================== Task Item ====================

    @Override
    public List<ApmsTaskItem> selectItems(Long taskId) {
        return itemMapper.selectByTaskId(taskId);
    }

    @Override
    public int insertItem(ApmsTaskItem item) {
        validateItemType(item);
        return itemMapper.insert(item);
    }

    @Override
    public int updateItem(ApmsTaskItem item) {
        validateItemType(item);
        return itemMapper.update(item);
    }

    private void validateItemType(ApmsTaskItem item) {
        if ("INDICATOR".equals(item.getItemType())) {
            if (item.getIndicatorId() == null) {
                throw new ServiceException("INDICATOR 类型必须填写 indicator_id");
            }
            item.setModelId(null);
        } else if ("MODEL".equals(item.getItemType())) {
            if (item.getModelId() == null) {
                throw new ServiceException("MODEL 类型必须填写 model_id");
            }
            item.setIndicatorId(null);
        } else {
            throw new ServiceException("item_type 必须是 INDICATOR 或 MODEL");
        }
    }

    @Override
    public int deleteItem(Long itemId) {
        return itemMapper.deleteById(itemId);
    }

    // ==================== Task Member ====================

    @Override
    public List<ApmsTaskMember> selectMembers(Long taskId) {
        return memberMapper.selectByTaskId(taskId);
    }

    @Override
    public int enrollMember(Long taskId, Long athleteId) {
        ApmsTaskMember m = new ApmsTaskMember();
        m.setTaskId(taskId);
        m.setAthleteId(athleteId);
        m.setStatus("pending");
        return memberMapper.insert(m);
    }

    @Override
    @Transactional
    public int batchEnroll(Long taskId, List<Long> athleteIds) {
        int count = 0;
        for (Long aid : athleteIds) count += enrollMember(taskId, aid);
        return count;
    }

    @Override
    public int updateMemberStatus(Long taskId, Long athleteId, String status) {
        ApmsTaskMember m = new ApmsTaskMember();
        m.setTaskId(taskId);
        m.setAthleteId(athleteId);
        m.setStatus(status);
        return memberMapper.update(m);
    }

    @Override
    public int removeMember(Long taskId, Long athleteId) {
        return memberMapper.delete(taskId, athleteId);
    }
}
