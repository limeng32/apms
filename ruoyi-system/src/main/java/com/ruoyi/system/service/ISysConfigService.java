package com.ruoyi.system.service;

import java.util.List;
import com.ruoyi.system.domain.SysConfig;

/**
 * 参数配置 服务层
 * 
 * @author ruoyi
 */
public interface ISysConfigService
{
    /**
     * 查询参数配置信息
     * 
     * @param configId 参数配置ID
     * @return 参数配置信息
     */
    public SysConfig selectConfigById(Long configId);

    /**
     * 根据键名查询参数配置信息
     * 
     * @param configKey 参数键名
     * @return 参数键值
     */
    public String selectConfigByKey(String configKey);

    /**
     * 获取验证码开关
     * 
     * @return true开启，false关闭
     */
    public boolean selectCaptchaEnabled();

    /**
     * 人机验证码开关（sys.account.sliderCaptchaEnabled，默认关闭）。
     * 开启后登录/发码强制图形点选校验（历史上为滑块拼图，参数键与方法名沿用以免迁移配置），
     * 与字符/算术验证码互斥。
     *
     * @return true开启，false关闭
     */
    public boolean selectSliderCaptchaEnabled();

    /**
     * 手机短信登录开关（sys.account.smsLoginEnabled，默认关闭）。
     * 开启前需在 env.conf 配置阿里云短信 AK/SK；关闭后发码/短信登录接口全部拒绝。
     *
     * @return true开启，false关闭
     */
    public boolean selectSmsLoginEnabled();

    /**
     * 是否允许平台内置管理员（userId=1）通过账号密码登录。
     * key sys.login.adminPasswordEnabled，默认 true（缺省放行，避免升级即锁死管理员）。
     * 登录页默认只暴露短信入口、密码入口为隐藏后门；关闭后即使调出后门，
     * userId=1 仍无法密码登录（其他有密码账号不受影响）。
     *
     * @return true允许（默认），false拒绝
     */
    public boolean selectAdminPasswordLoginEnabled();

    /**
     * 判断手机号是否在短信发送白名单（sys.sms.whitelistPhones）。
     *
     * <p>白名单为逗号分隔的 11 位手机号，在「参数设置」维护并随参数缓存热生效；
     * 命中白名单的手机号豁免短信发送类频控（60s 重发间隔、单号/IP 日上限、
     * 接口 IP 限流），但滑块人机校验与验证码错误锁定仍生效。
     *
     * @param phone 待判定手机号
     * @return true 在白名单内；空配置/空号码/格式不符均返回 false
     */
    public boolean isSmsWhitelistPhone(String phone);

    /**
     * 查询参数配置列表
     * 
     * @param config 参数配置信息
     * @return 参数配置集合
     */
    public List<SysConfig> selectConfigList(SysConfig config);

    /**
     * 新增参数配置
     * 
     * @param config 参数配置信息
     * @return 结果
     */
    public int insertConfig(SysConfig config);

    /**
     * 修改参数配置
     * 
     * @param config 参数配置信息
     * @return 结果
     */
    public int updateConfig(SysConfig config);

    /**
     * 批量删除参数信息
     * 
     * @param configIds 需要删除的参数ID
     */
    public void deleteConfigByIds(Long[] configIds);

    /**
     * 加载参数缓存数据
     */
    public void loadingConfigCache();

    /**
     * 清空参数缓存数据
     */
    public void clearConfigCache();

    /**
     * 重置参数缓存数据
     */
    public void resetConfigCache();

    /**
     * 校验参数键名是否唯一
     * 
     * @param config 参数信息
     * @return 结果
     */
    public boolean checkConfigKeyUnique(SysConfig config);
}
