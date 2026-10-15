package com.ruoyi.system.service;

import java.util.List;
import com.ruoyi.common.core.domain.TreeSelect;
import com.ruoyi.common.core.domain.entity.SysDept;

/**
 * 部门管理 服务层
 * 
 * @author ruoyi
 */
public interface ISysDeptService
{
    /**
     * 查询部门管理数据
     * 
     * @param dept 部门信息
     * @return 部门信息集合
     */
    public List<SysDept> selectDeptList(SysDept dept);

    /**
     * 查询部门树结构信息
     * 
     * @param dept 部门信息
     * @return 部门树信息集合
     */
    public List<TreeSelect> selectDeptTreeList(SysDept dept);

    /**
     * 构建前端所需要树结构
     * 
     * @param depts 部门列表
     * @return 树结构列表
     */
    public List<SysDept> buildDeptTree(List<SysDept> depts);

    /**
     * 构建前端所需要下拉树结构
     * 
     * @param depts 部门列表
     * @return 下拉树结构列表
     */
    public List<TreeSelect> buildDeptTreeSelect(List<SysDept> depts);

    /**
     * 根据角色ID查询部门树信息
     * 
     * @param roleId 角色ID
     * @return 选中部门列表
     */
    public List<Long> selectDeptListByRoleId(Long roleId);

    /**
     * 根据部门ID查询信息
     * 
     * @param deptId 部门ID
     * @return 部门信息
     */
    public SysDept selectDeptById(Long deptId);

    /**
     * 根据ID查询所有子部门（正常状态）
     * 
     * @param deptId 部门ID
     * @return 子部门数
     */
    public int selectNormalChildrenDeptById(Long deptId);

    /**
     * 是否存在部门子节点
     * 
     * @param deptId 部门ID
     * @return 结果
     */
    public boolean hasChildByDeptId(Long deptId);

    /**
     * 查询部门是否存在用户
     * 
     * @param deptId 部门ID
     * @return 结果 true 存在 false 不存在
     */
    public boolean checkDeptExistUser(Long deptId);

    /**
     * 查询部门下是否存在在队运动员
     *
     * @param deptId 部门ID
     * @return 结果 true 存在 false 不存在
     */
    public boolean checkDeptExistAthlete(Long deptId);

    /**
     * 校验部门名称是否唯一
     * 
     * @param dept 部门信息
     * @return 结果
     */
    public boolean checkDeptNameUnique(SysDept dept);

    /**
     * 校验部门是否有数据权限
     * 
     * @param deptId 部门id
     */
    public void checkDeptDataScope(Long deptId);

    /**
     * 校验目标部门是否在当前登录人的「本部门及以下」管理范围内。
     *
     * <p>客户侧管理员（如 super）即使角色数据范围配置为「全部数据」，
     * 创建/编辑/导入用户时也只能把用户放在本人所属部门及其子部门内，
     * 防止跨客户组织建号。平台管理员(userId=1)全放行；deptId 为空时不校验
     * （与 {@link #checkDeptDataScope(Long)} 口径一致，由调用方/表单约束必填）。
     *
     * @param deptId 目标部门id
     */
    public void checkDeptManageScope(Long deptId);

    /**
     * 新增保存部门信息
     * 
     * @param dept 部门信息
     * @return 结果
     */
    public int insertDept(SysDept dept);

    /**
     * 修改保存部门信息
     * 
     * @param dept 部门信息
     * @return 结果
     */
    public int updateDept(SysDept dept);

    /**
     * 保存部门排序
     *
     * @param deptIds 部门ID数组
     * @param orderNums 排序数组
     */
    public void updateDeptSort(String[] deptIds, String[] orderNums);

    /**
     * 删除部门管理信息
     * 
     * @param deptId 部门ID
     * @return 结果
     */
    public int deleteDeptById(Long deptId);
}
