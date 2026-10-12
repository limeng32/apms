package com.ruoyi.system.service.apms.batchimport;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;
import com.ruoyi.common.exception.ServiceException;

/**
 * 批量导入表格读取器：按文件扩展名统一读取为 String[][] 矩阵。
 *
 * <ul>
 *   <li>.csv：UTF-8 手写状态机（引号包裹/双引号转义/BOM），与历史成绩 CSV 导入同口径；</li>
 *   <li>.xlsx/.xls：Apache POI + DataFormatter，数字/日期按显示值取字符串。</li>
 * </ul>
 * 本类只负责"文件 → 字符串矩阵"，不含任何业务解析。
 *
 * @author apms
 */
@Component
public class TabularFileReader {

    /** 数据行上限（不含表头），超出直接报错，防止超大文件拖垮导入 */
    public static final int MAX_DATA_ROWS = 1000;

    /**
     * @param in       文件流
     * @param fileName 原始文件名（按扩展名判定格式）
     * @return 行矩阵（含表头行；空尾行已剔除）
     */
    public List<String[]> read(InputStream in, String fileName) {
        String name = fileName == null ? "" : fileName.toLowerCase();
        List<String[]> rows;
        if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
            rows = readExcel(in);
        } else if (name.endsWith(".csv")) {
            rows = readCsv(in);
        } else {
            throw new ServiceException("不支持的文件格式，请上传 .xlsx / .xls / .csv 文件");
        }
        // 统计非空行（表头之后）
        long dataRows = rows.stream().skip(1).filter(this::notAllBlank).count();
        if (dataRows > MAX_DATA_ROWS) {
            throw new ServiceException("数据行数 " + dataRows + " 超过上限 " + MAX_DATA_ROWS + " 行，请拆分后导入");
        }
        return rows;
    }

    // ================= CSV =================

    private List<String[]> readCsv(InputStream is) {
        List<String[]> result = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                result.add(parseOneCsvLine(line));
            }
        } catch (Exception e) {
            throw new ServiceException("CSV 解析失败：" + e.getMessage());
        }
        // 剔除尾部纯空行
        trimTrailingBlank(result);
        return result;
    }

    private String[] parseOneCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuote = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuote) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        cur.append('"');
                        i++;
                    } else {
                        inQuote = false;
                    }
                } else {
                    cur.append(c);
                }
            } else {
                if (c == '"') {
                    inQuote = true;
                } else if (c == ',') {
                    fields.add(cur.toString());
                    cur.setLength(0);
                } else {
                    cur.append(c);
                }
            }
        }
        fields.add(cur.toString());
        // 去掉 BOM
        if (!fields.isEmpty() && !fields.get(0).isEmpty() && fields.get(0).charAt(0) == 0xFEFF) {
            String first = fields.get(0);
            fields.set(0, first.substring(1));
        }
        return fields.toArray(new String[0]);
    }

    // ================= Excel（xlsx/xls） =================

    private List<String[]> readExcel(InputStream is) {
        List<String[]> result = new ArrayList<>();
        DataFormatter formatter = new DataFormatter();
        try (Workbook wb = WorkbookFactory.create(is)) {
            Sheet sheet = wb.getNumberOfSheets() > 0 ? wb.getSheetAt(0) : null;
            if (sheet == null) return result;
            int lastRow = sheet.getLastRowNum();
            int maxCol = 0;
            // 先扫一遍确定最大列数，保证每行数组等宽
            for (int r = 0; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row != null) maxCol = Math.max(maxCol, row.getLastCellNum());
            }
            for (int r = 0; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                String[] arr = new String[Math.max(maxCol, 1)];
                for (int c = 0; c < arr.length; c++) {
                    arr[c] = "";
                    if (row != null) {
                        Cell cell = row.getCell(c);
                        if (cell != null) {
                            String v = formatter.formatCellValue(cell);
                            arr[c] = v == null ? "" : v;
                        }
                    }
                }
                result.add(arr);
            }
        } catch (Exception e) {
            throw new ServiceException("Excel 解析失败：" + e.getMessage());
        }
        trimTrailingBlank(result);
        return result;
    }

    // ================= 工具 =================

    private boolean notAllBlank(String[] row) {
        if (row == null) return false;
        for (String s : row) {
            if (s != null && !s.trim().isEmpty()) return true;
        }
        return false;
    }

    private void trimTrailingBlank(List<String[]> rows) {
        int end = rows.size();
        while (end > 0 && !notAllBlank(rows.get(end - 1))) end--;
        rows.subList(end, rows.size()).clear();
    }
}
