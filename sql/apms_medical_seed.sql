-- ============================================================
-- P4 医疗附件 — 种子数据
-- 5 种 record_type: injury/illness/surgery/rehabilitation/checkup
-- 覆盖 1014 徐梦瑶(F) + 1015 陈思琪(F) + 部分男队员
-- mock file_path (profile/upload/2024/12/xxx.pdf, 真实文件不存在)
-- ============================================================

SET NAMES utf8mb4;
TRUNCATE TABLE apms_medical_file;
TRUNCATE TABLE apms_medical_record;

-- ======= 徐梦瑶 (athlete_id=1014, F, U18梯队) =======
-- 1. injury 损伤
INSERT INTO apms_medical_record (id, athlete_id, record_type, record_date, institution, title, remark, create_by, create_time) VALUES
(1, 1014, 'injury', '2024-11-05', '国家体育总局运动医学研究所', '右膝内侧副韧带轻度拉伤', '训练中变向落地时拉伤，MRI 确诊 MCL 一级扭伤，建议保守治疗 4 周。', 'admin', NOW());

INSERT INTO apms_medical_file (id, record_id, file_name, file_path, file_size, file_ext, upload_by, upload_time) VALUES
(1, 1, '徐梦瑶-右膝MRI报告.pdf', 'profile/upload/2024/12/xumengyao-knee-mri.pdf', 2450000, 'pdf', 'admin', NOW()),
(2, 1, '伤处照片.jpg',          'profile/upload/2024/12/xumengyao-knee-photo.jpg',   890000,  'jpg', 'admin', NOW());

-- 2. rehabilitation 康复
INSERT INTO apms_medical_record (id, athlete_id, record_type, record_date, institution, title, remark, create_by, create_time) VALUES
(2, 1014, 'rehabilitation', '2024-11-20', '北京积水潭医院运动医学康复中心', '术后康复第2周', '关节活动度恢复良好，屈伸角度达 120°，本周开始平衡训练。', 'admin', NOW());

INSERT INTO apms_medical_file (id, record_id, file_name, file_path, file_size, file_ext, upload_by, upload_time) VALUES
(3, 2, '康复评估表.docx', 'profile/upload/2024/12/xumengyao-rehab-week2.docx', 320000, 'docx', 'admin', NOW());

-- 3. checkup 体检
INSERT INTO apms_medical_record (id, athlete_id, record_type, record_date, institution, title, remark, create_by, create_time) VALUES
(3, 1014, 'checkup', '2024-10-15', '北京同仁医院', '年度入队体检', '各项指标正常，心电图提示窦性心律不齐，建议定期复查。', 'admin', NOW());

INSERT INTO apms_medical_file (id, record_id, file_name, file_path, file_size, file_ext, upload_by, upload_time) VALUES
(4, 3, '体检总报告.pdf',  'profile/upload/2024/12/xumengyao-checkup-2024.pdf', 1800000, 'pdf', 'admin', NOW()),
(5, 3, '心电图报告.png',  'profile/upload/2024/12/xumengyao-ecg.png',           450000,  'png', 'admin', NOW());

-- ======= 陈思琪 (athlete_id=1015, F, U16梯队) =======
-- 4. illness 疾病
INSERT INTO apms_medical_record (id, athlete_id, record_type, record_date, institution, title, remark, create_by, create_time) VALUES
(4, 1015, 'illness', '2024-10-28', '校医院', '上呼吸道感染', '发烧 38.5℃，咳嗽伴咽痛，隔离休息 5 天，痊愈后逐步恢复训练量。', 'admin', NOW());

-- 5. surgery 手术
INSERT INTO apms_medical_record (id, athlete_id, record_type, record_date, institution, title, remark, create_by, create_time) VALUES
(5, 1015, 'surgery', '2024-08-12', '北医三院运动医学科', '左踝腓骨远端骨折内固定术', '滑板训练落地导致，钛合金钢板固定，术后 12 个月评估取钉。', 'admin', NOW());

INSERT INTO apms_medical_file (id, record_id, file_name, file_path, file_size, file_ext, upload_by, upload_time) VALUES
(6, 5, '术前X光.png',       'profile/upload/2024/12/chensiqi-ankle-preop.png',  520000,  'png', 'admin', NOW()),
(7, 5, '术后X光.png',       'profile/upload/2024/12/chensiqi-ankle-postop.png', 480000,  'png', 'admin', NOW()),
(8, 5, '手术记录.pdf',      'profile/upload/2024/12/chensiqi-surgery-note.pdf', 1100000, 'pdf', 'admin', NOW()),
(9, 5, '出院小结.pdf',      'profile/upload/2024/12/chensiqi-discharge.pdf',    650000,  'pdf', 'admin', NOW());

-- 6. 康复
INSERT INTO apms_medical_record (id, athlete_id, record_type, record_date, institution, title, remark, create_by, create_time) VALUES
(6, 1015, 'rehabilitation', '2024-12-01', '国家体育总局康复中心', '术后第 16 周 — 慢跑恢复', '可完成 30 分钟连续慢跑无疼痛，踝关节活动度恢复至健侧 85%。', 'admin', NOW());

INSERT INTO apms_medical_file (id, record_id, file_name, file_path, file_size, file_ext, upload_by, upload_time) VALUES
(10, 6, '康复进度表.xlsx',  'profile/upload/2024/12/chensiqi-rehab-progress.xlsx', 280000, 'xlsx', 'admin', NOW());

-- ======= 男队员 =======
-- 7. 陈嘉宇 (1004) injury
INSERT INTO apms_medical_record (id, athlete_id, record_type, record_date, institution, title, remark, create_by, create_time) VALUES
(7, 1004, 'injury', '2024-09-20', '队医室', '右大腿股二头肌拉伤（Ⅱ级）', '冲刺训练时拉伤，停训 3 周后重返，恢复训练量 70%。', 'admin', NOW());

-- 8. 周泽霖 (1008) checkup
INSERT INTO apms_medical_record (id, athlete_id, record_type, record_date, institution, title, remark, create_by, create_time) VALUES
(8, 1008, 'checkup', '2024-11-10', '北医三院体检中心', '入队后专项体能评估', 'VO₂max 62.5 ml/kg/min 达国家级健将水平，RSA sdec 2.1% 优异。', 'admin', NOW());

INSERT INTO apms_medical_file (id, record_id, file_name, file_path, file_size, file_ext, upload_by, upload_time) VALUES
(11, 8, '体能评估报告.pdf', 'profile/upload/2024/12/zhouzelin-vo2max.pdf', 1350000, 'pdf', 'admin', NOW());

-- 9. 张志远 (1001) illness
INSERT INTO apms_medical_record (id, athlete_id, record_type, record_date, institution, title, remark, create_by, create_time) VALUES
(9, 1001, 'illness', '2024-07-15', '北京协和医院变态反应科', '季节性过敏性鼻炎加重', '花粉季症状加剧，调整训练时间至傍晚，用药：布地奈德鼻喷雾。', 'admin', NOW());

-- 10. 孙宇辰 (1007) injury
INSERT INTO apms_medical_record (id, athlete_id, record_type, record_date, institution, title, remark, create_by, create_time) VALUES
(10, 1007, 'injury', '2024-12-02', '队医室', '左手腕三角软骨盘轻微损伤', '负重训练后疼痛，戴护腕保护 2 周，避免拧转动作。', 'admin', NOW());

INSERT INTO apms_medical_file (id, record_id, file_name, file_path, file_size, file_ext, upload_by, upload_time) VALUES
(12, 10, '腕部超声报告.pdf', 'profile/upload/2024/12/sunyuchen-wrist-us.pdf', 780000, 'pdf', 'admin', NOW());

-- ======= 验证 =======
SELECT type, COUNT(*) AS cnt FROM (
  SELECT 'record' AS type FROM apms_medical_record
  UNION ALL SELECT 'file' FROM apms_medical_file
) t GROUP BY type;
SELECT 'record_types:' AS info;
SELECT record_type, COUNT(*) FROM apms_medical_record GROUP BY record_type ORDER BY record_type;
