import React from 'react';
import { SpeedLog } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface Props {
  logs: SpeedLog[];
}

export default function SpeedLogTable({ logs }: Props) {
  return (
    <section className="bg-white/95 rounded-[32px] shadow-sm p-5 mb-6 border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-slate-900">차량 속도 감지 기록</h3>
        <p className="text-sm text-slate-500">최근 {logs.length}건의 속도 기록을 확인하세요.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-[0.12em]">
              <th className="px-3 py-2 text-left">기록 ID</th>
              <th className="px-3 py-2 text-left">감지 시간</th>
              <th className="px-3 py-2 text-left">위치</th>
              <th className="px-3 py-2 text-right">측정 속도</th>
              <th className="px-3 py-2 text-right">제한 속도</th>
              <th className="px-3 py-2 text-center">판정</th>
              <th className="px-3 py-2 text-center">방지턱 동작</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const judgKind =
                log.judgment === '정상'
                  ? 'success'
                  : log.judgment === '주의'
                  ? 'warning'
                  : 'danger';
              const actionKind =
                log.bumpAction === '유지'
                  ? 'success'
                  : log.bumpAction === '상승'
                  ? 'warning'
                  : 'danger';

              return (
                <tr
                  key={log.id}
                  className="border-t border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-3 py-2 text-gray-500">{log.id}</td>
                  <td className="px-3 py-2">{log.detectedAt.replace('T', ' ')}</td>
                  <td className="px-3 py-2">{log.location}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {log.measuredSpeed} km/h
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {log.speedLimit} km/h
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge kind={judgKind}>{log.judgment}</StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge kind={actionKind}>{log.bumpAction}</StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
