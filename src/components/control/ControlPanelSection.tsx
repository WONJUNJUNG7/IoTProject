import React, { useState } from 'react';
import { Device } from '../../types';

interface Props {
  devices: Device[];
}

export default function ControlPanelSection({ devices }: Props) {
  const [selectedId, setSelectedId] = useState(devices[0]?.id ?? '');
  const [angle, setAngle] = useState<number>(90);
  const [log, setLog] = useState<string[]>([]);

  // 🌟 D1 보드가 연결을 시도하는 백엔드 서버의 주소 (정보 제공용)
  // 실제 D1 보드 펌웨어의 SERVER_URL과 일치해야 합니다.
  const apiUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : 'http://localhost:4000';

  const append = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLog((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 20));
  };

  // 🚀 [올림 버튼용] 백엔드 REST API(/api/bump?val=1) 호출
  const handleRaise = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/bump?val=1`, { method: 'POST' });
      if (!response.ok) throw new Error(`status ${response.status}`);
      append(`[${selectedId}] 백엔드 서버(${apiUrl})를 통해 방지턱 올리기 (UP) 명령 완료`);
    } catch (err) {
      console.error('D1 제어 에러:', err);
      append(`[${selectedId}] 🚨 올리기 명령 전송 실패 (서버 터미널 확인 필요)`);
    }
  };

  // 🚀 [내림 버튼용] 백엔드 REST API(/api/bump?val=0) 호출
  const handleLower = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/bump?val=0`, { method: 'POST' });
      if (!response.ok) throw new Error(`status ${response.status}`);
      append(`[${selectedId}] 백엔드 서버(${apiUrl})를 통해 방지턱 내리기 (DOWN) 명령 완료`);
    } catch (err) {
      console.error('D1 제어 에러:', err);
      append(`[${selectedId}] 🚨 내리기 명령 전송 실패 (서버 터미널 확인 필요)`);
    }
  };

  const handleSetAngle = async () => {
    try {
      const constrained = Math.max(0, Math.min(180, angle));
      const response = await fetch(`${apiUrl}/api/servo?angle=${constrained}`);
      if (!response.ok) throw new Error(`status ${response.status}`);
      append(`[${selectedId}] 각도 ${constrained}도 전송 완료`);
    } catch (err) {
      console.error('D1 각도 제어 에러:', err);
      append(`[${selectedId}] 🚨 각도 명령 전송 실패 (서버 터미널 확인 필요)`);
    }
  };

  // 나머지 버튼들 (기존 mock 유지)
  const handleLed = () => { append(`[${selectedId}] 경고 LED 점등 (mock)`); };
  const handleBuzzer = () => { append(`[${selectedId}] 부저 테스트 실행 (mock)`); };
  const handleRestart = () => { append(`[${selectedId}] 장치 재시작 (mock)`); };

  return (
    <section className="bg-white/95 rounded-[32px] shadow-sm p-5 mb-6 border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">제어 패널 (방지턱 실시간 연동)</h3>
          <p className="text-sm text-slate-500 mt-1">선택한 장치에 대해 빠른 명령을 전송할 수 있습니다.</p>
        </div>
        <div className="text-sm text-green-600 font-medium">✓ WiFi D1 방지턱 제어 활성화</div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <label className="block text-sm text-slate-600 mb-2">대상 장치</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full border border-slate-300 rounded-2xl px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id} - {d.location}
              </option>
            ))}
          </select>

          {/* 🌟 중요:onClick 버튼에 handleRaise와 handleLower가 확실히 물리도록 바인딩 완료 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ControlButton color="blue" onClick={handleRaise}>
              방지턱 강제 올림 (UP)
            </ControlButton>
            <ControlButton color="green" onClick={handleLower}>
              방지턱 강제 내림 (DOWN)
            </ControlButton>
            <ControlButton color="blue" onClick={handleSetAngle}>
              각도 전송 ({angle}°)
            </ControlButton>
            <ControlButton color="red" onClick={handleLed}>
              경고 LED 켜기
            </ControlButton>
            <ControlButton color="yellow" onClick={handleBuzzer}>
              부저 테스트 실행
            </ControlButton>
            <ControlButton color="gray" onClick={handleRestart}>
              장치 재시작
            </ControlButton>
          </div>
          <div className="mt-4">
            <label className="block text-sm text-slate-600 mb-2">서보 각도 설정</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={180}
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="w-28 border border-slate-300 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                type="range"
                min={0}
                max={180}
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">0~180 사이 값을 입력한 뒤 '각도 전송'을 눌러 주세요.</p>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            ※ D1 보드 연결 대상 서버 주소: <span className="font-semibold text-slate-600">{apiUrl}</span>
          </p>
        </div>

        <div className="flex-1 bg-slate-50/90 rounded-[24px] p-4 border border-slate-200">
          <p className="text-sm font-semibold text-slate-800 mb-3">제어 로그</p>
          <div className="text-xs font-mono text-slate-600 space-y-2 max-h-64 overflow-y-auto pr-1">
            {log.length === 0 ? (
              <p className="text-slate-400">아직 실행된 명령이 없습니다.</p>
            ) : (
              log.map((line, i) => <div key={i}>{line}</div>)
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ControlButton({
  color,
  onClick,
  children,
}: {
  color: 'blue' | 'green' | 'red' | 'yellow' | 'gray';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white w-full py-2 rounded-md text-sm font-medium',
    green: 'bg-green-600 hover:bg-green-700 text-white w-full py-2 rounded-md text-sm font-medium',
    red: 'bg-red-600 hover:bg-red-700 text-white w-full py-2 rounded-md text-sm font-medium',
    yellow: 'bg-yellow-500 hover:bg-yellow-600 text-white w-full py-2 rounded-md text-sm font-medium',
    gray: 'bg-slate-600 hover:bg-slate-700 text-white w-full py-2 rounded-md text-sm font-medium',
  };
  return (
    <button onClick={onClick} className={cls[color]}>
      {children}
    </button>
  );
}