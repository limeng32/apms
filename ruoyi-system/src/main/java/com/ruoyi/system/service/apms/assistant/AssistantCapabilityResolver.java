package com.ruoyi.system.service.apms.assistant;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.system.domain.vo.RouterVo;
import com.ruoyi.system.service.ISysMenuService;

/**
 * 将当前用户的菜单树还原为完整前端路由集合。
 *
 * <p>必须使用 {@link ISysMenuService#buildMenus}（与 GET /getRouters 同源），
 * 不能直接比较 sys_menu.path：子菜单 path 往往是相对路径。
 */
@Service
public class AssistantCapabilityResolver
{
    @Autowired
    private ISysMenuService menuService;

    public Set<String> resolvePaths(Long userId)
    {
        List<RouterVo> routers = menuService.buildMenus(menuService.selectMenuTreeByUserId(userId));
        Set<String> paths = new LinkedHashSet<>();
        collect(routers, "", paths);
        // 业务首页为静态路由，不在菜单树内
        paths.add("/index");
        return paths;
    }

    public List<String> suggestions()
    {
        return Arrays.asList(
                "怎么新增运动员",
                "PHV 在哪里计算",
                "怎么导入测试成绩",
                "组合评分怎么算",
                "RTP 状态怎么修改",
                "报告在哪里下载");
    }

    private void collect(List<RouterVo> routers, String parentPath, Set<String> out)
    {
        if (routers == null || routers.isEmpty())
        {
            return;
        }
        for (RouterVo router : routers)
        {
            String full = joinPath(parentPath, router.getPath());
            List<RouterVo> children = router.getChildren();
            if (children != null && !children.isEmpty())
            {
                collect(children, full, out);
            }
            else
            {
                out.add(normalize(full));
            }
        }
    }

    private String joinPath(String parent, String path)
    {
        if (path == null || path.isEmpty())
        {
            return parent == null || parent.isEmpty() ? "/" : parent;
        }
        if (path.equals("/"))
        {
            return parent == null || parent.isEmpty() ? "/" : parent;
        }
        if (path.startsWith("/"))
        {
            return path;
        }
        if (parent == null || parent.isEmpty() || parent.equals("/"))
        {
            return "/" + path;
        }
        return parent + "/" + path;
    }

    private String normalize(String path)
    {
        if (path == null || path.isEmpty())
        {
            return "/";
        }
        String p = path.replaceAll("/+", "/");
        if (p.length() > 1 && p.endsWith("/"))
        {
            p = p.substring(0, p.length() - 1);
        }
        return p;
    }

    /** 给前端 capabilities 使用的有序列表（排除根路径） */
    public List<String> resolvePathList(Long userId)
    {
        Set<String> paths = resolvePaths(userId);
        List<String> list = new ArrayList<>();
        for (String p : paths)
        {
            if (!p.equals("/"))
            {
                list.add(p);
            }
        }
        return list;
    }
}
