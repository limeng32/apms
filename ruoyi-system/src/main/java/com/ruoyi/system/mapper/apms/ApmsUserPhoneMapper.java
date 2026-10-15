package com.ruoyi.system.mapper.apms;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.system.domain.apms.ApmsUserPhone;

/**
 * 账号-登录手机号绑定 Mapper
 *
 * @author apms
 */
public interface ApmsUserPhoneMapper
{
    /**
     * 查询某账号的全部绑定号码（按绑定时间升序）
     */
    public List<ApmsUserPhone> selectByUserId(Long userId);

    /**
     * 按绑定主键查询
     */
    public ApmsUserPhone selectById(Long id);

    /**
     * 按手机号查询全部绑定记录（一个手机号允许绑定多个账号，可能多条；按 user_id 升序）
     */
    public List<ApmsUserPhone> selectListByPhone(String phonenumber);

    /**
     * 统计某账号已绑定号码数
     */
    public int countByUserId(Long userId);

    /**
     * 新增绑定
     */
    public int insertApmsUserPhone(ApmsUserPhone record);

    /**
     * 按主键删除绑定（个人中心解绑 / 管理员强制解绑，归属与越权校验在 Service/Controller 完成）
     */
    public int deleteApmsUserPhoneById(Long id);

    /**
     * 按账号删除全部绑定（用户逻辑删除链路同事务调用）
     */
    public int deleteByUserId(Long userId);

    /**
     * 按账号批量删除全部绑定（批量删除用户同事务调用）
     */
    public int deleteByUserIds(@Param("userIds") Long[] userIds);
}
