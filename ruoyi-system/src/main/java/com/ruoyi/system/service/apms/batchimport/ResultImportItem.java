package com.ruoyi.system.service.apms.batchimport;

import java.io.Serializable;
import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTestResult;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;

/**
 * 一行内单个指标的待入库项（system 层 DTO，与 admin 层 Controller 内部类 AddBody 解耦）。
 *
 * @author apms
 */
public class ResultImportItem implements Serializable {

    private static final long serialVersionUID = 1L;

    private ApmsTestResult result;
    private List<ApmsTestResultValue> values;

    public ResultImportItem() {
    }

    public ResultImportItem(ApmsTestResult result, List<ApmsTestResultValue> values) {
        this.result = result;
        this.values = values;
    }

    public ApmsTestResult getResult() { return result; }
    public void setResult(ApmsTestResult result) { this.result = result; }
    public List<ApmsTestResultValue> getValues() { return values; }
    public void setValues(List<ApmsTestResultValue> values) { this.values = values; }
}
