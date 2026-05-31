import React, { useEffect, useState } from 'react';

interface AdminHeaderProps {
  title: string;
}

// 1초마다 갱신되는 현재 시각 표시
function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatNow(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function AdminHeader({ title }: AdminHeaderProps) {
  const now = useNow();

  return (
    <header className="bg-white/95 border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between sticky top-0 z-20 backdrop-blur-sm shadow-sm">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">
          최신 상태로 자동 갱신 중 — {formatNow(now)}
        </p>
      </div>
      <div className="mt-3 md:mt-0 text-sm text-slate-500">
        운영 데이터는 현재 mock 데이터로 표시됩니다.
      </div>
    </header>
  );
}
