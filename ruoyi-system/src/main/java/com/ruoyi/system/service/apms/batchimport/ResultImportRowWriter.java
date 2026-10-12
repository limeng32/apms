package com.ruoyi.system.service.apms.batchimport;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.system.service.apms.IApmsTestResultService;

/**
 * 成绩导入行级事务：一行内多个指标（多个 add）纳入同一事务，
 * 任一指标失败整行回滚，不产生半行数据；不影响下一行。
 *
 * <p>必须作为独立 bean 跨类调用（Facade 注入本类），保证 Spring 事务代理生效；
 * REQUIRED 传播使多次 add 加入同一个行事务，add 内部的最佳试次/REP/任务进度/
 * 体态同步/PHV 等随整行一起提交或回滚。
 *
 * @author apms
 */
@Component
public class ResultImportRowWriter {

    @Autowired
    private IApmsTestResultService testResultService;

    /**
     * @throws Exception 行内任一 add 抛出时整行回滚，异常上抛由 Facade 记为该行失败
     */
    @Transactional(rollbackFor = Exception.class, propagation = Propagation.REQUIRED)
    public void writeRow(List<ResultImportItem> items) {
        for (ResultImportItem item : items) {
            testResultService.add(item.getResult(), item.getValues());
        }
    }
}
