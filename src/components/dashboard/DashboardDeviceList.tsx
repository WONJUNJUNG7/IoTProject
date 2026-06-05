import React, { useMemo, useState } from 'react';
import { Device, DeviceStatus } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface Props {
  devices: Device[];
  onSelect: (device: Device) => void;
  selectedDevice: Device | null;
}

type StatusFilter = '전체' | DeviceStatus;

export default function DashboardDeviceList({ devices, onSelect, selectedDevice }: Props) {
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
    <section className="bg-white/95 rounded-[28px] shadow-sm p-5 border border-slate-200 max-h-[38rem]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">실시간 방지턱 상태</h3>
          <p className="text-sm text-slate-500 mt-1">현재 {devices.length}개 장치의 상태를 확인할 수 있습니다.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="위치명 검색"
            className="w-full sm:w-48 border border-slate-300 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            className="w-full sm:w-36 border border-slate-300 rounded-2xl px-3 py-2 text-sm"
          >
            <option value="전체">전체</option>
            <option value="정상">정상</option>
            <option value="대기">대기</option>
            <option value="오류">오류</option>
          </select>
        </div>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filtered.map((d) => (
          <DeviceListItem
            key={d.id}
            device={d}
            isSelected={selectedDevice?.id === d.id}
            onClick={() => onSelect(d)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">
            조건에 맞는 장치가 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}

function DeviceListItem({ device, isSelected, onClick }: { device: Device; isSelected: boolean; onClick: () => void }) {
  const statusKind =
    device.status === '정상'
      ? 'success'
      : device.status === '대기'
      ? 'warning'
      : 'error';

  const isOverSpeed = device.currentSpeed > device.speedLimit;

  return (
    <div
      className={`border rounded-3xl p-4 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{device.id}</p>
          <p className="font-semibold text-slate-800">{device.location}</p>
          <p className="text-sm text-gray-600">
            속도: {device.currentSpeed} km/h (제한: {device.speedLimit} km/h)
            {isOverSpeed && <span className="text-red-500 ml-1">⚠️</span>}
          </p>
        </div>
        <StatusBadge kind={statusKind}>{device.status}</StatusBadge>
      </div>
    </div>
  );
}