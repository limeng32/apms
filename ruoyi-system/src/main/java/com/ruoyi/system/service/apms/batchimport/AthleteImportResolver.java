package com.ruoyi.system.service.apms.batchimport;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.ruoyi.system.domain.apms.ApmsAthlete;

/**
 * 批量导入运动员解析器：编号精确 / 姓名精确等值 / 数据权限 / 重名拦截。
 *
 * <p>输入必须是文件解析出的<b>原始字符串</b>（parseRows 不做任何人匹配），
 * 杜绝旧链路「LIKE 模糊 + 取第一条」的错配流入新导入。
 *
 * @author apms
 */
@Component
public class AthleteImportResolver {

    @Autowired
    private AthleteScopeQuery scopeQuery;

    /** 单行解析结果 */
    public static class Result {
        public boolean matched;
        public ApmsAthlete athlete;
        /** 阻断原因（matched=false 时） */
        public String error;
        /** 非阻断提示（如编号命中但姓名与填写不一致） */
        public String warning;

        static Result fail(String error) {
            Result r = new Result();
            r.matched = false;
            r.error = error;
            return r;
        }

        static Result ok(ApmsAthlete a, String warning) {
            Result r = new Result();
            r.matched = true;
            r.athlete = a;
            r.warning = warning;
            return r;
        }
    }

    /**
     * 解析一行的运动员。
     *
     * @param idRaw   athlete_id 列原始值（可空）
     * @param nameRaw athlete_name 列原始值（id 为空时必填）
     */
    public Result resolve(String idRaw, String nameRaw) {
        String id = idRaw == null ? "" : idRaw.trim();
        String name = nameRaw == null ? "" : nameRaw.trim();

        if (!id.isEmpty()) {
            long parsedId;
            try {
                parsedId = Long.parseLong(id);
            } catch (NumberFormatException e) {
                return Result.fail("运动员编号必须是数字，实际为：「" + id + "」");
            }
            ApmsAthlete q = new ApmsAthlete();
            q.setAthleteId(parsedId);
            List<ApmsAthlete> list = scopeQuery.findScoped(q);
            if (list.isEmpty()) {
                return Result.fail("运动员编号 " + id + " 不存在或不在当前数据权限范围内");
            }
            ApmsAthlete hit = list.get(0);
            // 姓名仅作核对：同时填写且不一致时给警告（仍以编号为准）
            String warning = null;
            if (!name.isEmpty() && hit.getName() != null && !hit.getName().trim().equals(name)) {
                warning = "编号 " + id + " 对应「" + hit.getName() + "」，与填写姓名「" + name + "」不一致，已按编号匹配";
            }
            return Result.ok(hit, warning);
        }

        if (name.isEmpty()) {
            return Result.fail("未填写运动员编号或姓名");
        }
        ApmsAthlete q = new ApmsAthlete();
        q.setName(name);
        List<ApmsAthlete> list = scopeQuery.findScoped(q);
        if (list.isEmpty()) {
            return Result.fail("匹配不到队员「" + name + "」，请核对姓名或填写运动员编号");
        }
        if (list.size() > 1) {
            return Result.fail("姓名「" + name + "」在数据范围内重名（" + list.size() + " 人），请填写运动员编号");
        }
        return Result.ok(list.get(0), null);
    }

    /** commit 前复检：athleteId 此刻仍在当前用户数据权限内 */
    public boolean existsInScope(Long athleteId) {
        if (athleteId == null) return false;
        ApmsAthlete q = new ApmsAthlete();
        q.setAthleteId(athleteId);
        return !scopeQuery.findScoped(q).isEmpty();
    }
}
