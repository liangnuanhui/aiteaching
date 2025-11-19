/**
 * Student Selector Component
 * Dropdown to select a student from the class
 */

'use client';

import React from 'react';

interface Student {
  id: number;
  name: string;
  nickname: string | null;
}

interface StudentSelectorProps {
  students: Student[];
  value: number | null;
  onChange: (studentId: number) => void;
  className?: string;
}

export function StudentSelector({
  students,
  value,
  onChange,
  className = '',
}: StudentSelectorProps) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(Number(e.target.value))}
      className={`block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
    >
      <option value="">请选择学生</option>
      {students.map(student => (
        <option key={student.id} value={student.id}>
          {student.name}
          {student.nickname && ` (${student.nickname})`}
        </option>
      ))}
    </select>
  );
}
