export function lessonStudents(lesson) {
  return lesson?.student_ids ?? (lesson?.student_id ? [lesson.student_id] : []);
}

export function liveLessonPath(lessonId) {
  return `/lessons/${encodeURIComponent(lessonId)}/live`;
}
