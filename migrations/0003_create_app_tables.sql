-- Migration: 0003_create_app_tables
-- Description: Create classes, students, lesson_cards, lesson_contents, uploads tables
-- Created: 2025-11-22
-- Note: These tables were previously created via prisma db push, now added to migration history

-- Create classes table
CREATE TABLE IF NOT EXISTS "classes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "grade_level" TEXT NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "classes_teacher_id_idx" ON "classes"("teacher_id");
CREATE INDEX IF NOT EXISTS "classes_grade_level_idx" ON "classes"("grade_level");

-- Create students table
CREATE TABLE IF NOT EXISTS "students" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "class_id" INTEGER NOT NULL,
    "nickname" TEXT,
    "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "students_class_id_idx" ON "students"("class_id");
CREATE INDEX IF NOT EXISTS "students_name_idx" ON "students"("name");

-- Create lesson_cards table
CREATE TABLE IF NOT EXISTS "lesson_cards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "class_id" INTEGER NOT NULL,
    "h5_json" TEXT NOT NULL DEFAULT '{}',
    "md_plan" TEXT NOT NULL DEFAULT '',
    "lesson_group_id" TEXT,
    "content_id" TEXT,
    "is_content_shared" BOOLEAN NOT NULL DEFAULT true,
    "original_content_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    "deleted_at" INTEGER,
    CONSTRAINT "lesson_cards_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "lesson_cards_class_id_idx" ON "lesson_cards"("class_id");
CREATE INDEX IF NOT EXISTS "lesson_cards_lesson_group_id_idx" ON "lesson_cards"("lesson_group_id");
CREATE INDEX IF NOT EXISTS "lesson_cards_status_idx" ON "lesson_cards"("status");

-- Create lesson_contents table
CREATE TABLE IF NOT EXISTS "lesson_contents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "h5_json" TEXT NOT NULL DEFAULT '{}',
    "md_plan" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT ''
);

-- Create uploads table
CREATE TABLE IF NOT EXISTS "uploads" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lesson_id" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "original_filename" TEXT NOT NULL,
    "ocr_text" TEXT,
    "recognized_name" TEXT,
    "ocr_confidence" REAL,
    "work_type" TEXT,
    "work_description" TEXT,
    "work_keywords" TEXT,
    "work_emotions" TEXT,
    "content_extracted_at" INTEGER,
    "triage_status" TEXT NOT NULL DEFAULT 'pending',
    "student_id" INTEGER,
    "suggested_student_id" INTEGER,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "uploaded_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    "processed_at" INTEGER,
    "archived_at" INTEGER,
    CONSTRAINT "uploads_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lesson_cards" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "uploads_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "uploads_suggested_student_id_fkey" FOREIGN KEY ("suggested_student_id") REFERENCES "students" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "uploads_lesson_id_idx" ON "uploads"("lesson_id");
CREATE INDEX IF NOT EXISTS "uploads_student_id_idx" ON "uploads"("student_id");
CREATE INDEX IF NOT EXISTS "uploads_file_hash_idx" ON "uploads"("file_hash");
CREATE INDEX IF NOT EXISTS "uploads_triage_status_idx" ON "uploads"("triage_status");

-- Create reports table
CREATE TABLE IF NOT EXISTS "reports" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lesson_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    CONSTRAINT "reports_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lesson_cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "reports_lesson_id_key" ON "reports"("lesson_id");
