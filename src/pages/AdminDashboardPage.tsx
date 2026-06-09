import React, { useMemo, useState, useEffect } from 'react';
import AdminSidebar from '../components/layout/AdminSidebar';
import AdminHeader from '../components/layout/AdminHeader';
import StatCard from '../components/dashboard/StatCard';
import DeviceStatusSection from '../components/device/DeviceStatusSection';
import SpeedLogTable from '../components/logs/SpeedLogTable';
import EventLogSection from '../components/logs/EventLogSection';
import DeviceManagementSection from '../components/device/DeviceManagementSection';
import ControlPanelSection from '../components/control/ControlPanelSection';
import CCTVViewer from '../components/cctv/CCTVViewer';
import DashboardDeviceList from '../components/dashboard/DashboardDeviceList';
import {
  mockDevices,
  mockSpeedLogs,
  mockEventLogs,
} from '../data/mockData';
import { EventLog, MenuKey, Device } from '../types';
import { useArduinoData } from '../hooks/useArduinoData';

const titleMap: Record<MenuKey, string> = {
  dashboard: '대시보드',
  realtime: '실시간 상태',
  speedLog: '속도 기록',
  eventLog: '경고 로그',
  devices: '장치 관리',
  control: '제어 패널',
  cctv: 'CCTV 모니터링',
  settings: '설정',
};

const ESP32_CAM_STREAM_URL = 'http://172.20.10.3/stream';

export default function AdminDashboardPage() {
  const [active, setActive] = useState<MenuKey>('dashboard');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  // 이벤트 로그는 "확인" 버튼으로 상태가 바뀌므로 state로 관리
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);

  // 아두이노 실시간 데이터
  const { arduinoData, shockCount, isConnected, error, controlBump, stats: serverStats } = useArduinoData();

  // 실제 API가 있으면 fetch하고, 실패 시 최소값으로 보여줌
  const minimalDevices: Device[] = [
    {
      id: 'BUMP-001',
      location: '테스트 방지턱',
      status: '정상',
      vehicleDetected: false,
      currentSpeed: 0,
      speedLimit: 30,
      bumpStatus: '대기 중',
      ledColor: '초록',
      buzzer: '정지',
      lastUpdate: new Date().toISOString(),
      sensorStatus: '정상',
      actuatorStatus: '정상',
      powerStatus: '정상',
      networkStatus: '연결',
      firmwareVersion: 'v1.0.0',
    },
  ];

  const [devices, setDevices] = useState<Device[]>(minimalDevices);
  const [speedLogs, setSpeedLogs] = useState([] as any[]);

  useEffect(() => {
    let mounted = true;

    async function loadMocks() {
      try {
        const [dRes, eRes, sRes] = await Promise.all([
          fetch('http://localhost:4000/api/devices'),
          fetch('http://localhost:4000/api/event-logs'),
          fetch('http://localhost:4000/api/speed-logs'),
        ]);

        if (!mounted) return;

        // 서버에서 정상 응답이 오면 서버 데이터를 사용
        if (dRes.ok) setDevices(await dRes.json());
        else setDevices(minimalDevices);

        if (eRes.ok) setEventLogs(await eRes.json());
        else setEventLogs([]);

        if (sRes.ok) setSpeedLogs(await sRes.json());
        else setSpeedLogs([]);
      } catch (err) {
        // 실패하면 서버 없음으로 간주하고 최소값을 사용
        console.warn('API 로드 실패 — 서버 미실행으로 처리, 최소값 사용:', err);
        if (!mounted) return;
        setDevices(minimalDevices);
        setEventLogs([]);
        setSpeedLogs([]);
      }
    }

    loadMocks();

    return () => {
      mounted = false;
    };
  }, []);

  // 통계 계산
  const stats = useMemo(() => {
    const total = devices.length;
    const operating = devices.filter((d) => d.status === '정상').length;
    const errors = devices.filter((d) => d.status === '오류').length;
    const todayDetected = speedLogs.length;
    const overSpeed = speedLogs.filter((s) => s.judgment === '과속').length;
    const avgSpeed =
      speedLogs.length === 0
        ? 0
        : Math.round(
            speedLogs.reduce((sum, s) => sum + s.measuredSpeed, 0) /
              speedLogs.length
          );
    return { total, operating, errors, todayDetected, overSpeed, avgSpeed };
  }, [devices, speedLogs]);

  const unreadCount = eventLogs.filter((e) => e.status === '미확인').length;

  // 이벤트 로그 "확인" 처리
  const handleAcknowledge = (id: string) => {
    // TODO: POST /api/event-logs/{id}/acknowledge
    setEventLogs((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: '확인 완료' } : e))
    );
  };

  // 서버 통계가 있으면 우선 사용
  const display = {
    total: serverStats?.totalDevices ?? stats.total,
    operating: serverStats?.operating ?? stats.operating,
    todayDetected: serverStats?.todayDetected ?? stats.todayDetected,
    overSpeed: serverStats?.overSpeed ?? stats.overSpeed,
    currentSpeed: arduinoData.speed,
    avgSpeed: (serverStats as any)?.avgSpeed ?? stats.avgSpeed,
  };

  // 사이드바 메뉴별 콘텐츠 렌더
  const renderContent = () => {
    switch (active) {
      case 'dashboard':
        return (
          <>
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-[24px] shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">📡 실시간 센서 데이터</h3>
                  <p className="text-sm text-slate-500 mt-1">Socket.io로 수신 중인 아두이노 센서 데이터를 확인하세요.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-sm font-medium text-slate-600">
                    {isConnected ? '연결됨' : '연결 해제'}
                  </span>
                </div>
              </div>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  ⚠️ {error}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-4 border border-purple-200">
                  <p className="text-xs uppercase tracking-wider text-purple-600 font-semibold">속도</p>
                  <p className="text-3xl font-bold text-purple-900 mt-2">{arduinoData.speed.toFixed(1)}</p>
                  <p className="text-xs text-slate-500 mt-1">km/h</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-orange-200">
                  <p className="text-xs uppercase tracking-wider text-orange-600 font-semibold">충격 감지 횟수</p>
                  <p className="text-3xl font-bold text-orange-900 mt-2">{shockCount}</p>
                  <p className="text-xs text-slate-500 mt-1">400 이상일 때 카운트</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-red-200">
                  <p className="text-xs uppercase tracking-wider text-red-600 font-semibold">온도</p>
                  <p className="text-3xl font-bold text-red-900 mt-2">{arduinoData.temperature.toFixed(1)}</p>
                  <p className="text-xs text-slate-500 mt-1">°C</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <p className="text-xs uppercase tracking-wider text-blue-600 font-semibold">습도</p>
                  <p className="text-3xl font-bold text-blue-900 mt-2">{arduinoData.humidity.toFixed(1)}</p>
                  <p className="text-xs text-slate-500 mt-1">%</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-300 rounded-[24px] shadow-sm p-6 mb-6">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-slate-900">🎮 방지턱 원격 제어</h3>
                <p className="text-sm text-slate-500 mt-1">관리자가 방지턱을 수동으로 제어할 수 있습니다.</p>
              </div>
              {!isConnected && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                  ⚠️ 소켓이 연결되지 않아 제어가 불가능합니다.
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => controlBump('UP')}
                  disabled={!isConnected}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <span>▲</span>
                  <span>방지턱 강제 올림 (UP)</span>
                </button>
                <button
                  onClick={() => controlBump('DOWN')}
                  disabled={!isConnected}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <span>▼</span>
                  <span>방지턱 강제 내림 (DOWN)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 mb-6">
              <div className="bg-white/95 rounded-[28px] shadow-sm p-5 border border-slate-200">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">요약 통계</h3>
                  <p className="text-sm text-slate-500 mt-1">주요 지표를 2열 3행으로 정리했습니다.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatCard label="전체 설치 방지턱" value={display.total} unit="대" accent="blue" icon="🚧" />
                  <StatCard label="정상 작동 장치" value={display.operating} unit="대" accent="green" icon="✅" />
                  <StatCard label="오늘 감지된 차량" value={display.todayDetected} unit="대" accent="blue" icon="🚗" />
                  <StatCard label="오늘 과속 감지" value={display.overSpeed} unit="건" accent="red" icon="⚠️" />
                  <StatCard label="현재 차량 속도" value={display.currentSpeed.toFixed(1)} unit="km/h" accent="green" icon="🏎️" />
                  <StatCard label="평균 차량 속도" value={display.avgSpeed} unit="km/h" accent="yellow" icon="📈" />
                </div>
              </div>

              <div>
                <CCTVViewer streamUrls={[ESP32_CAM_STREAM_URL, null]} />
              </div>
            </div>

            <DashboardDeviceList
              devices={devices}
              onSelect={setSelectedDevice}
              selectedDevice={selectedDevice}
            />

            <EventLogSection logs={eventLogs} onAcknowledge={handleAcknowledge} />
          </>
        );
      case 'realtime':
        return <DeviceStatusSection devices={devices} />;
      case 'speedLog':
        return <SpeedLogTable logs={speedLogs} />;
      case 'eventLog':
        return <EventLogSection logs={eventLogs} onAcknowledge={handleAcknowledge} />;
      case 'devices':
        return <DeviceManagementSection devices={devices} />;
      case 'control':
        return <ControlPanelSection devices={devices} />;
      case 'cctv':
        return <CCTVViewer streamUrls={[ESP32_CAM_STREAM_URL, null]} />;
      case 'settings':
        return (
          <div className="bg-white rounded-lg shadow-sm p-6 text-gray-500">
            설정 페이지는 준비 중입니다.
          </div>
        );
    }
  };

  return (
    <div className="flex bg-slate-100 min-h-screen text-slate-800">
      <AdminSidebar
        active={active}
        onChange={setActive}
        adminName="김관리"
        badges={{ eventLog: unreadCount }}
      />

      <div className="flex-1 flex flex-col">
        <AdminHeader title={titleMap[active]} />
        <main className="p-6 flex-1 space-y-6">{renderContent()}</main>
      </div>
    </div>
  );
}
