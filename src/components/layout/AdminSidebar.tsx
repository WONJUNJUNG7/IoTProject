import React, { useState } from 'react';
import { MenuKey } from '../../types';

interface AdminSidebarProps {
  active: MenuKey;
  onChange: (key: MenuKey) => void;
  adminName: string;
  badges?: Partial<Record<MenuKey, number>>;
}

const menus: { key: MenuKey; label: string; icon: string }[] = [
  { key: 'dashboard', label: '대시보드', icon: '📊' },
  { key: 'realtime', label: '실시간 상태', icon: '📡' },
  { key: 'speedLog', label: '속도 기록', icon: '🚗' },
  { key: 'eventLog', label: '경고 로그', icon: '⚠️' },
  { key: 'devices', label: '장치 관리', icon: '🛠️' },
  { key: 'control', label: '제어 패널', icon: '🎛️' },
  { key: 'cctv', label: 'CCTV 모니터링', icon: '📹' },
  { key: 'settings', label: '설정', icon: '⚙️' },
];

export default function AdminSidebar({ active, onChange, adminName, badges }: AdminSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Bottom hamburger bar */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen((s) => !s)}
            aria-label="메뉴 열기"
            className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Slide-up menu */}
      {open && (
        <div className="fixed inset-x-4 bottom-20 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">메뉴</div>
                <div className="text-xs text-slate-500">{adminName} · 관리자</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-500">닫기</button>
            </div>
            <nav className="grid grid-cols-4 gap-2 p-3">
              {menus.map((m) => {
                const badgeCount = badges?.[m.key] ?? 0;
                return (
                  <button
                    key={m.key}
                    onClick={() => {
                      onChange(m.key);
                      setOpen(false);
                    }}
                    className="flex flex-col items-center gap-1 py-2 px-2 rounded hover:bg-slate-50"
                  >
                    <div className="text-xl">{m.icon}</div>
                    <div className="text-xs text-slate-700">{m.label}</div>
                    {badgeCount > 0 && (
                      <div className="text-[11px] bg-red-500 text-white rounded-full px-2 mt-1">{badgeCount}</div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
