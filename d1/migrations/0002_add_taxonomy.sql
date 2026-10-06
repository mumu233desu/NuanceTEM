-- 迁移 0002：新增题目分类标签索引表与用户偏好字段扩展

-- 1. 为 users 表扩展偏好配置 JSON 字段
ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{"theme":"auto","dailyTarget":20,"examLevel":"TEM4"}';

-- 2. 新增题目元数据表 (用于云端题库检索与考点统计)
CREATE TABLE IF NOT EXISTS questions_metadata (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL,
    field TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    group_name TEXT,
    target_word TEXT
);

CREATE INDEX IF NOT EXISTS idx_questions_level_mech ON questions_metadata(level, mechanism);
CREATE INDEX IF NOT EXISTS idx_questions_level_field ON questions_metadata(level, field);
