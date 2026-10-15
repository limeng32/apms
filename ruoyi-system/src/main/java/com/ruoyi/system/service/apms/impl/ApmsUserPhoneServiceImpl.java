package com.ruoyi.system.service.apms.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsUserPhone;
import com.ruoyi.system.mapper.SysUserMapper;
import com.ruoyi.system.mapper.apms.ApmsUserPhoneMapper;
import com.ruoyi.system.service.apms.IApmsUserPhoneService;

/**
 * 账号-登录手机号绑定 Service 实现
 *
 * @author apms
 */
@Service
public class ApmsUserPhoneServiceImpl implements IApmsUserPhoneService
{
    @Autowired
    private ApmsUserPhoneMapper apmsUserPhoneMapper;

    @Autowired
    private SysUserMapper userMapper;

    @Override
    public List<ApmsUserPhone> selectByUserId(Long userId)
    {
        return apmsUserPhoneMapper.selectByUserId(userId);
    }

    @Override
    public ApmsUserPhone selectById(Long id)
    {
        return apmsUserPhoneMapper.selectById(id);
    }

    @Override
    public List<ApmsUserPhone> selectListByPhone(String phonenumber)
    {
        return apmsUserPhoneMapper.selectListByPhone(phonenumber);
    }

    @Override
    public int countByUserId(Long userId)
    {
        return apmsUserPhoneMapper.countByUserId(userId);
    }

    /**
     * P0 并发安全：事务首句对 sys_user 目标行加 X 锁，
     * 同一账号的并发绑定请求在此串行 → count→insert 不会出现 2+2=4。
     * 不同账号绑定同一手机号的跨账号并发由 uk_phonenumber 唯一索引兜底。
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public void bindPhone(Long userId, String phone, String operator)
    {
        Long lockedId = userMapper.lockUserByIdForUpdate(userId);
        if (lockedId == null)
        {
            throw new ServiceException("账号不存在或已删除，无法绑定手机号");
        }
        if (apmsUserPhoneMapper.countByUserId(userId) >= ApmsUserPhone.MAX_PER_USER)
        {
            throw new ServiceException("每个账号最多绑定 " + ApmsUserPhone.MAX_PER_USER + " 个手机号，请先解绑后再添加");
        }
        ApmsUserPhone record = new ApmsUserPhone();
        record.setUserId(userId);
        record.setPhonenumber(phone);
        record.setCreateBy(operator);
        try
        {
            apmsUserPhoneMapper.insertApmsUserPhone(record);
        }
        catch (DuplicateKeyException e)
        {
            // uk_user_phone(user_id, phonenumber) 冲突：该号码已绑定在当前账号
            throw new ServiceException("该手机号已绑定在当前账号，无需重复绑定");
        }
    }

    @Override
    public int unbindOwn(Long loginUserId, Long id)
    {
        ApmsUserPhone record = apmsUserPhoneMapper.selectById(id);
        if (record == null || !record.getUserId().equals(loginUserId))
        {
            // 不暴露 id 是否存在：统一按无权处理
            throw new ServiceException("无权解绑该手机号");
        }
        return apmsUserPhoneMapper.deleteApmsUserPhoneById(id);
    }

    @Override
    public int unbindById(Long id)
    {
        return apmsUserPhoneMapper.deleteApmsUserPhoneById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int deleteByUserId(Long userId)
    {
        return apmsUserPhoneMapper.deleteByUserId(userId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int deleteByUserIds(Long[] userIds)
    {
        if (userIds == null || userIds.length == 0)
        {
            return 0;
        }
        return apmsUserPhoneMapper.deleteByUserIds(userIds);
    }
}
