import React from 'react';

// 상태값을 색상이 있는 작은 배지로 표시
type BadgeKind =
  | 'success'  // 정상
  | 'warning'  // 주의/대기
  | 'danger'   // 과속/경고
  | 'error'    // 오류 (진한 빨강)
  | 'info'     // 통신 중/처리 중
  | 'neutral';

interface StatusBadgeProps {
  kind: BadgeKind;
  children: React.ReactNode;
}

const kindToClass: Record<BadgeKind, string> = {
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  danger:  'bg-red-100 text-red-700 border-red-200',
  error:   'bg-red-200 text-red-900 border-red-300',
  info:    'bg-blue-100 text-blue-700 border-blue-200',
  neutral: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function StatusBadge({ kind, children }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${kindToClass[kind]}`}
    >
      {children}
    </span>
  );
}
