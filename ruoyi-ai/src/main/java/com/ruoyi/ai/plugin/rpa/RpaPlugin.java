package com.ruoyi.ai.plugin.rpa;

import org.springframework.stereotype.Component;
import com.ruoyi.ai.core.AiEnabled;
import com.ruoyi.ai.core.AiPlugin;

/**
 * RPA 助手插件描述符（首个 AI 插件，M1 伪 RPA）。
 *
 * <p>热开关：{@code sys.ai.rpa.enabled}（缺省开启，参数设置热生效）。
 *
 * @author apms
 */
@AiEnabled
@Component
public class RpaPlugin implements AiPlugin
{
    public static final String KEY = "rpa";

    @Override
    public String key()
    {
        return KEY;
    }

    @Override
    public String name()
    {
        return "RPA 助手";
    }

    @Override
    public String description()
    {
        return "系统内悬浮问答助手：自然语言规划操作路径、SSE 流式指引（M1 伪 RPA）";
    }
}
