package com.ruoyi.system.domain.apms;

import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 医疗记录主表 apms_medical_record
 */
public class ApmsMedicalRecord extends BaseEntity {
    private Long id;
    private Long athleteId;
    /** injury / illness / surgery / rehabilitation / checkup */
    private String recordType;
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date recordDate;
    private String institution;
    private String title;
    private String remark;

    // LEFT JOIN 解析
    private String athleteName;
    private String athleteGender;
    private String athleteTeam;

    // 聚合
    private List<ApmsMedicalFile> files;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public String getRecordType() { return recordType; }
    public void setRecordType(String recordType) { this.recordType = recordType; }
    public Date getRecordDate() { return recordDate; }
    public void setRecordDate(Date recordDate) { this.recordDate = recordDate; }
    public String getInstitution() { return institution; }
    public void setInstitution(String institution) { this.institution = institution; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public String getAthleteName() { return athleteName; }
    public void setAthleteName(String n) { this.athleteName = n; }
    public String getAthleteGender() { return athleteGender; }
    public void setAthleteGender(String g) { this.athleteGender = g; }
    public String getAthleteTeam() { return athleteTeam; }
    public void setAthleteTeam(String t) { this.athleteTeam = t; }
    public List<ApmsMedicalFile> getFiles() { return files; }
    public void setFiles(List<ApmsMedicalFile> files) { this.files = files; }
}
