-- Migration number: 0003 	 2025-11-21T03:13:22.906Z

-- 添加多模型元数据字段
ALTER TABLE uploads ADD COLUMN model_consensus REAL;
ALTER TABLE uploads ADD COLUMN model_count INTEGER;

-- 添加教育专业字段
ALTER TABLE uploads ADD COLUMN educational_observations TEXT;
ALTER TABLE uploads ADD COLUMN teaching_suggestions TEXT;
ALTER TABLE uploads ADD COLUMN age_appropriateness TEXT;
ALTER TABLE uploads ADD COLUMN creative_elements TEXT;
