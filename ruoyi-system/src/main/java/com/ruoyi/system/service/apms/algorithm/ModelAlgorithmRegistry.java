package com.ruoyi.system.service.apms.algorithm;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 模型派生算法注册表：Spring 自动收集所有 {@link ModelDeriveAlgorithm} 实现，
 * 按 algoId 分发；同时为模型管理页提供可绑定算法清单。
 */
@Component
public class ModelAlgorithmRegistry {

    private final Map<String, ModelDeriveAlgorithm> algorithms = new LinkedHashMap<>();

    @Autowired
    public ModelAlgorithmRegistry(List<ModelDeriveAlgorithm> all) {
        for (ModelDeriveAlgorithm a : all) {
            algorithms.put(a.algoId(), a);
        }
    }

    public ModelDeriveAlgorithm get(String algoId) {
        return algoId == null ? null : algorithms.get(algoId.trim());
    }

    public List<ModelDeriveAlgorithm> list() {
        return new ArrayList<>(algorithms.values());
    }
}
