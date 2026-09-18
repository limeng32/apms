package com.ruoyi.common.exception;

/**
 * apms_task_item 配置互斥校验失败
 *
 * <p>
 * 规则：
 *   item_type=INDICATOR → indicator_id 必填, model_id 必须为 NULL
 *   item_type=MODEL     → model_id 必填, indicator_id 必须为 NULL
 *   同一 task_id 下不允许重复配置相同的 indicator_id 或 model_id
 */
public class TaskItemConfigException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public TaskItemConfigException(String message) {
        super(message);
    }
}
