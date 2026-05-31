import React, { useMemo, useState } from 'react';
import { Device, DeviceStatus } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface Props {
  devices: Device[];
}

type StatusFilter = '전체' | DeviceStatus;

export default function DeviceStatusSection({ devices }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('전체');

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      const matchesSearch = d.location
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesFilter = filter === '전체' ? true : d.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [devices, search, filter]);

  return (
    <section className="bg-white/95 rounded-[32px] shadow-sm p-5 mb-6 border border-slate-200">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">실시간 방지턱 상태</h3>
          <p className="text-sm text-slate-500 mt-1">전체 {filtered.length}개 장치가 필터 조건에 따라 표시됩니다.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="위치명 검색"
            className="w-full md:w-72 border border-slate-300 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            className="w-full md:w-40 border border-slate-300 rounded-2xl px-3 py-2 text-sm"
          >
            <option value="전체">전체</option>
            <option value="정상">정상</option>
            <option value="대기">대기</option>
            <option value="오류">오류</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((d) => (
          <DeviceCard key={d.id} device={d} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 col-span-full text-center py-6">
            조건에 맞는 장치가 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}

function DeviceCard({ device }: { device: Device }) {
  // 상태별 배지 종류 매핑
  const statusKind =
    device.status === '정상'
      ? 'success'
      : device.status === '대기'
      ? 'warning'
      : 'error';

  const bumpKind =
    device.bumpStatus === '내려감'
      ? 'success'
      : device.bumpStatus === '올라감'
      ? 'danger'
      : device.bumpStatus === '대기 중'
      ? 'warning'
      : 'error';

  const ledKind =
    device.ledColor === '초록'
      ? 'success'
      : device.ledColor === '노랑'
      ? 'warning'
      : 'danger';

  const isOverSpeed = device.currentSpeed > device.speedLimit;

  return (
    <div className="border border-slate-200 rounded-[28px] p-4 hover:shadow-md transition-shadow bg-white">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs text-slate-400">{device.id}</p>
          <p className="font-semibold text-slate-900">{device.location}</p>
        </div>
        <StatusBadge kind={statusKind}>{device.status}</StatusBadge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mt-3">
        <Info label="차량 감지" value={device.vehicleDetected ? '감지됨' : '없음'} />
        <Info
          label="현재 속도"
          value={`${device.currentSpeed} km/h`}
          highlight={isOverSpeed}
        />
        <Info label="제한 속도" value={`${device.speedLimit} km/h`} />
        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-xs">방지턱</span>
          <StatusBadge kind={bumpKind}>{device.bumpStatus}</StatusBadge>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-xs">LED</span>
          <StatusBadge kind={ledKind}>{device.ledColor}</StatusBadge>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-xs">부저</span>
          <StatusBadge kind={device.buzzer === '작동' ? 'danger' : 'neutral'}>
            {device.buzzer}
          </StatusBadge>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-3">
        마지막 업데이트: {device.lastUpdate.replace('T', ' ')}
      </p>
    </div>
  );
}

function Info({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`font-medium ${highlight ? 'text-red-600' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}
