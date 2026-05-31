import React, { useState } from 'react';
import { Device } from '../../types';

interface Props {
  devices: Device[];
}

export default function ControlPanelSection({ devices }: Props) {
  const [selectedId, setSelectedId] = useState(devices[0]?.id ?? '');
  const [log, setLog] = useState<string[]>([]);

  const append = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLog((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 20));
  };

  // 각 mock 동작. 실제 IoT 연결 시 아래 주석 부분으로 교체.
  const handleRaise = () => {
    // TODO: POST /api/devices/{selectedId}/control { action: 'raise' }
    append(`[${selectedId}] 방지턱 올리기 명령 전송 (mock)`);
    alert('방지턱을 올리는 명령을 전송했습니다. (mock)');
  };
  const handleLower = () => {
    // TODO: POST /api/devices/{selectedId}/control { action: 'lower' }
    append(`[${selectedId}] 방지턱 내리기 명령 전송 (mock)`);
    alert('방지턱을 내리는 명령을 전송했습니다. (mock)');
  };
  const handleLed = () => {
    // TODO: POST /api/devices/{selectedId}/control { action: 'led', color: 'red' }
    append(`[${selectedId}] 경고 LED 점등 (mock)`);
    alert('경고 LED를 켰습니다. (mock)');
  };
  const handleBuzzer = () => {
    // TODO: POST /api/devices/{selectedId}/control { action: 'buzzer' }
    append(`[${selectedId}] 부저 테스트 실행 (mock)`);
    alert('부저 테스트를 실행했습니다. (mock)');
  };
  const handleRestart = () => {
    // TODO: POST /api/devices/{selectedId}/restart
    append(`[${selectedId}] 장치 재시작 (mock)`);
    alert('장치를 재시작합니다. (mock)');
  };

  return (
    <section className="bg-white/95 rounded-[32px] shadow-sm p-5 mb-6 border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">제어 패널 (테스트)</h3>
          <p className="text-sm text-slate-500 mt-1">선택한 장치에 대해 빠른 명령을 전송할 수 있습니다.</p>
        </div>
        <div className="text-sm text-slate-500">실제 API 연결 전에는 mock 동작으로 실행됩니다.</div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ControlButton color="blue" onClick={handleRaise}>
              방지턱 올리기
            </ControlButton>
            <ControlButton color="green" onClick={handleLower}>
              방지턱 내리기
            </ControlButton>
            <ControlButton color="red" onClick={handleLed}>
              경고 LED 켜기
            </ControlButton>
            <ControlButton color="yellow" onClick={handleBuzzer}>
              부저 테스트
            </ControlButton>
            <ControlButton color="gray" onClick={handleRestart}>
              장치 재시작
            </ControlButton>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            ※ 실제 IoT 장치 제어 API는 아직 연결되지 않았습니다. (mock 동작)
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
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    red: 'bg-red-600 hover:bg-red-700 text-white',
    yellow: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    gray: 'bg-slate-600 hover:bg-slate-700 text-white',
  };
  return (
    <button
      onClick={onClick}
      className={`py-2 rounded-md text-sm font-medium ${cls[color]}`}
    >
      {children}
    </button>
  );
}
