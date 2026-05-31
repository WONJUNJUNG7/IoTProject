import React from 'react';
import { Device } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface Props {
  devices: Device[];
}

export default function DeviceManagementSection({ devices }: Props) {
  // TODO: 실제 API 연동 시 fetch(`/api/devices/${id}`)
  const handleManage = (d: Device) => {
    alert(
      `[장치 정보]\n\nID: ${d.id}\n위치: ${d.location}\n센서: ${d.sensorStatus}\n` +
        `구동 장치: ${d.actuatorStatus}\n전원: ${d.powerStatus}\n` +
        `네트워크: ${d.networkStatus}\n펌웨어: ${d.firmwareVersion}\n` +
        `마지막 업데이트: ${d.lastUpdate.replace('T', ' ')}`
    );
  };

  return (
    <section className="bg-white rounded-lg shadow-sm p-5 mb-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">장치 관리</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
              <th className="px-3 py-2 text-left">장치 ID</th>
              <th className="px-3 py-2 text-left">위치</th>
              <th className="px-3 py-2 text-center">센서</th>
              <th className="px-3 py-2 text-center">구동 장치</th>
              <th className="px-3 py-2 text-center">전원</th>
              <th className="px-3 py-2 text-center">네트워크</th>
              <th className="px-3 py-2 text-center">펌웨어</th>
              <th className="px-3 py-2 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">{d.id}</td>
                <td className="px-3 py-2">{d.location}</td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge kind={d.sensorStatus === '정상' ? 'success' : 'error'}>
                    {d.sensorStatus}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge
                    kind={d.actuatorStatus === '정상' ? 'success' : 'error'}
                  >
                    {d.actuatorStatus}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge
                    kind={
                      d.powerStatus === '정상'
                        ? 'success'
                        : d.powerStatus === '낮음'
                        ? 'warning'
                        : 'error'
                    }
                  >
                    {d.powerStatus}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge
                    kind={d.networkStatus === '연결' ? 'info' : 'error'}
                  >
                    {d.networkStatus}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2 text-center text-gray-600">
                  {d.firmwareVersion}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => handleManage(d)}
                    className="px-3 py-1 bg-slate-700 text-white rounded text-xs hover:bg-slate-800"
                  >
                    관리
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
