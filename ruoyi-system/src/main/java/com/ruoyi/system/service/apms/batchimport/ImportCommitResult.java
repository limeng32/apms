package com.ruoyi.system.service.apms.batchimport;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 导入提交结果（写入 Redis done 快照，双击/重试幂等返回同一份）。
 *
 * @author apms
 */
public class ImportCommitResult implements Serializable {

    private static final long serialVersionUID = 1L;

    private int committed;
    private int skipped;
    private int failed;
    private List<String> failedDetails = new ArrayList<>();
    private List<String> skippedDetails = new ArrayList<>();

    public int getCommitted() { return committed; }
    public void setCommitted(int committed) { this.committed = committed; }
    public int getSkipped() { return skipped; }
    public void setSkipped(int skipped) { this.skipped = skipped; }
    public int getFailed() { return failed; }
    public void setFailed(int failed) { this.failed = failed; }
    public List<String> getFailedDetails() { return failedDetails; }
    public void setFailedDetails(List<String> failedDetails) { this.failedDetails = failedDetails; }
    public List<String> getSkippedDetails() { return skippedDetails; }
    public void setSkippedDetails(List<String> skippedDetails) { this.skippedDetails = skippedDetails; }
}
