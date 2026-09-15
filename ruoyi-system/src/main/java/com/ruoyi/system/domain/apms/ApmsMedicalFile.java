package com.ruoyi.system.domain.apms;

import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * 医疗附件文件 apms_medical_file
 */
public class ApmsMedicalFile {
    private Long id;
    private Long recordId;
    private String fileName;
    private String filePath;
    private Long fileSize;
    private String fileExt;
    private String uploadBy;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date uploadTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getRecordId() { return recordId; }
    public void setRecordId(Long recordId) { this.recordId = recordId; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getFileExt() { return fileExt; }
    public void setFileExt(String fileExt) { this.fileExt = fileExt; }
    public String getUploadBy() { return uploadBy; }
    public void setUploadBy(String uploadBy) { this.uploadBy = uploadBy; }
    public Date getUploadTime() { return uploadTime; }
    public void setUploadTime(Date uploadTime) { this.uploadTime = uploadTime; }
}
