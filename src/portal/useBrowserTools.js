import { useEffect } from 'react';

export function useBrowserTools(data, open) {
  useEffect(() => {
    const registry = document.modelContext;
    if (typeof registry?.registerTool !== 'function') return;
    const lifecycle = new AbortController();
    const options = { signal: lifecycle.signal };

    const tools = [{
      name: 'read_tutoring_overview',
      description: 'Read the current authorized tutor or student overview. Demo data is explicitly identified.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) {
          throw new Error('Expected an empty object');
        }
        return {
          demo: data.demo,
          role: data.role,
          students: data.students.map(({ id, name, level }) => ({ id, name, level })),
          lessons: data.lessons,
          payments: data.payments,
        };
      },
    }, {
      name: 'start_lesson_creation',
      description: 'Open the lesson scheduling form for a tutor.',
      inputSchema: { type: 'object', properties: { student_id: { type: 'string' } }, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) ||
          Object.keys(input).some((key) => key !== 'student_id') ||
          (input.student_id !== undefined && typeof input.student_id !== 'string')) {
          throw new Error('Invalid input');
        }
        if (data.role !== 'tutor') throw new Error('Tutor only');
        if (input.student_id && !data.students.some(({ id }) => id === input.student_id)) {
          throw new Error('Student not found');
        }
        open('lesson', { student_id: input.student_id });
        return { status: 'form_opened', saved: false };
      },
    }];

    for (const tool of tools) {
      try {
        Promise.resolve(registry.registerTool(tool, options)).catch(() => {});
      } catch {
        // The portal remains usable if tool registration fails.
      }
    }
    return () => lifecycle.abort();
  }, [data, open]);
}
