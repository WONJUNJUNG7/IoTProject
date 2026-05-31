import React, { useMemo, useState } from 'react';
import { EventLog, EventSeverity } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface Props {
  logs: EventLog[];
  onAcknowledge: (id: string) => void;
}

type SeverityFilter = '전체' | EventSeverity;

export default function EventLogSection({ logs, onAcknowledge }: Props) {
  const [filter, setFilter] = useState<SeverityFilter>('전체');
  const unreadCount = logs.filter((l) => l.status === '미확인').length;

  const filtered = useMemo(() => {
    if (filter === '전체') return logs;
    return logs.filter((l) => l.severity === filter);
  }, [logs, filter]);

  return (
    <section className="bg-white/95 rounded-[32px] shadow-sm p-5 mb-6 border border-slate-200">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">경고 및 이벤트 로그</h3>
          <p className="text-sm text-slate-500 mt-1">미확인 로그 {unreadCount}건을 포함하여 전체 {logs.length}건이 표시됩니다.</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as SeverityFilter)}
          className="w-full md:w-48 border border-slate-300 rounded-2xl px-3 py-2 text-sm"
        >
          <option value="전체">심각도 전체</option>
          <option value="낮음">낮음</option>
          <option value="보통">보통</option>
          <option value="높음">높음</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-[0.12em]">
              <th className="px-3 py-2 text-left">시간</th>
              <th className="px-3 py-2 text-left">장치</th>
              <th className="px-3 py-2 text-left">위치</th>
              <th className="px-3 py-2 text-left">이벤트 유형</th>
              <th className="px-3 py-2 text-center">심각도</th>
              <th className="px-3 py-2 text-center">처리 상태</th>
              <th className="px-3 py-2 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const sevKind =
                l.severity === '낮음'
                  ? 'success'
                  : l.severity === '보통'
                  ? 'warning'
                  : 'danger';
              const statusKind = l.status === '확인 완료' ? 'success' : 'info';

              return (
                <tr key={l.id} className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2">{l.occurredAt.replace('T', ' ')}</td>
                  <td className="px-3 py-2 text-gray-500">{l.deviceId}</td>
                  <td className="px-3 py-2">{l.location}</td>
                  <td className="px-3 py-2">{l.eventType}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge kind={sevKind}>{l.severity}</StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge kind={statusKind}>{l.status}</StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      disabled={l.status === '확인 완료'}
                      onClick={() => onAcknowledge(l.id)}
                      className={`px-3 py-1 rounded text-xs ${
                        l.status === '확인 완료'
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      확인
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-6">
                  표시할 이벤트가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
