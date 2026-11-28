ALTER TABLE `lessons` RENAME TO `legacy_lessons`;
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`duration` integer NOT NULL,
	`meeting_url` text DEFAULT '' NOT NULL,
	`meeting_type` text DEFAULT 'external' NOT NULL CHECK (`meeting_type` IN ('external', 'live')),
	`status` text DEFAULT 'scheduled' NOT NULL,
	`schedule_write_id` text
);
--> statement-breakpoint
INSERT INTO `lessons` (`id`, `title`, `starts_at`, `duration`, `meeting_url`, `status`)
SELECT `id`, `title`, `starts_at`, `duration`, `meeting_url`, `status` FROM `legacy_lessons`;
--> statement-breakpoint
CREATE TABLE `lesson_students` (
	`lesson_id` text NOT NULL REFERENCES `lessons` (`id`) ON DELETE CASCADE,
	`student_id` text NOT NULL REFERENCES `students` (`id`) ON DELETE CASCADE,
	PRIMARY KEY (`lesson_id`, `student_id`)
);
--> statement-breakpoint
INSERT INTO `lesson_students` (`lesson_id`, `student_id`)
SELECT `id`, `student_id` FROM `legacy_lessons`;
--> statement-breakpoint
CREATE INDEX `idx_lesson_students_student` ON `lesson_students` (`student_id`, `lesson_id`);
--> statement-breakpoint
CREATE INDEX `idx_lessons_starts_at` ON `lessons` (`starts_at`);
--> statement-breakpoint
DROP TABLE `legacy_lessons`;
