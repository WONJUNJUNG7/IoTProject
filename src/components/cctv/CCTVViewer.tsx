import React, { useRef, useState, useEffect } from 'react';

interface CCTVViewerProps {
  streamUrls?: (string | null)[];
}

export default function CCTVViewer({ streamUrls }: CCTVViewerProps) {
  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const [streamError, setStreamError] = useState(false);

  // 🌟 타겟 IP 주소 정의
  const baseIp = 'http://172.20.10.3';
  const streamUrl = `${baseIp}:81/stream`;

  // ⚙️ 웹페이지가 켜질 때 자동으로 ESP32-CAM의 Start Stream을 원격으로 눌러주는 작업
  useEffect(() => {
    const autoStartStream = async () => {
      try {
        // ESP32-CAM에게 "지금 당장 스트리밍 송출 시작해!"라고 명령을 보냅니다 (val=1이 시작 신호)
        await fetch(`${baseIp}/control?var=stream&val=1`, { mode: 'no-cors' });
        console.log("ESP32-CAM 자동 스트리밍 시작 신호 전송 완료");
      } catch (err) {
        console.error("스트리밍 시작 신호 전송 실패:", err);
      }
    };

    autoStartStream();
  }, []);

  const toggleFullscreen = (el: HTMLElement | null) => {
    if (!el) return;
    if (document.fullscreenElement === el) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    el.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="bg-white/95 rounded-[28px] shadow-sm p-6 border border-slate-200">
      <h2 className="text-xl font-semibold text-slate-900 mb-4">CCTV 모니터링</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        
        {/* 카메라 1 (ESP32-CAM) 구역 */}
        <div className="relative overflow-hidden rounded-[24px] border border-slate-200 shadow-sm bg-slate-950 min-h-[440px] flex flex-col" ref={mainContainerRef}>
          <div className="bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 z-10">
            카메라 1 (ESP32-CAM)
          </div>
          
          <div className="relative flex-1 w-full bg-black flex items-center justify-center">
            <img
              className="w-full h-full object-contain bg-black block"
              src={streamUrl}
              alt="ESP32-CAM 스트림"
              onError={() => setStreamError(true)}
              onLoad={() => setStreamError(false)}
            />
            <button
              onClick={() => toggleFullscreen(mainContainerRef.current)}
              aria-label="카메라 1 전체화면"
              className="absolute top-12 right-3 z-10 bg-black/60 hover:bg-black/80 text-white rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            >
              전체화면
            </button>
          </div>
        </div>

        {/* 카메라 2 구역 */}
        <div className="relative overflow-hidden rounded-[24px] border border-slate-200 shadow-sm bg-slate-950 min-h-[440px] flex flex-col">
          <div className="bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100">카메라 2</div>
          <div className="flex flex-1 items-center justify-center text-slate-500 text-sm bg-slate-950 px-4">
            <div className="text-center">
              <p className="mb-2 font-medium">카메라 2 비활성</p>
              <p className="text-xs text-slate-600">빈 화면으로 유지됩니다.</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* 하단 안내 문구 */}
      <div className="mt-4 text-xs text-slate-500 space-y-1">
        {streamError ? (
          <p className="text-red-600 font-medium">
            🚨 영상 로드 실패. 브라우저 주소창 왼쪽의 ⓘ 아이콘을 눌러 '안전하지 않은 콘텐츠'를 [허용]으로 변경한 뒤 F5를 눌러주세요.
          </p>
        ) : (
          <p className="text-green-600 font-medium">✓ ESP32-CAM 자동 신호 송출 명령이 활성화되었습니다.</p>
        )}
        <p>※ 현재 스트리밍 타겟 주소: <span className="font-semibold text-slate-700">{streamUrl}</span></p>
      </div>
    </div>
  );
}