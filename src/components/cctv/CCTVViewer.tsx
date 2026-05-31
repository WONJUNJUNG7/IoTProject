import React, { useEffect, useRef, useState } from 'react';

interface CCTVViewerProps {
  // 나중에 실제 카메라 스트림 URL을 받을 수 있도록 확장성 준비
  streamUrls?: string[];
}

export default function CCTVViewer({ streamUrls = [] }: CCTVViewerProps) {
  // 데모용 스트림 URL들 (실제로는 API나 props로 받음)
  const demoStreams = streamUrls.length > 0 ? streamUrls : [
    'https://www.w3schools.com/html/mov_bbb.mp4', // 데모 비디오
    'https://www.w3schools.com/html/movie.mp4',   // 다른 데모 비디오
  ];

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  useEffect(() => {
    let localStream: MediaStream | null = null;

    async function startWebcam() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        localStream = stream;
        if (videoRefs.current[0]) {
          videoRefs.current[0].srcObject = stream;
        }
      } catch (err) {
        console.error('웹캠 접근 오류:', err);
        setWebcamError(err instanceof Error ? err.message : String(err));
      }
    }

    startWebcam();

    return () => {
      // 언마운트 시 스트림 정리
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        localStream = null;
      }
      if (videoRefs.current[0]) {
        try {
          videoRefs.current[0].srcObject = null;
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const toggleFullscreen = (el: Element | null) => {
    if (!el) return;
    if (document.fullscreenElement === el) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    // request fullscreen on the element
    // Some browsers require prefixes, but modern browsers support this API
    (el as HTMLElement).requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="bg-white/95 rounded-[28px] shadow-sm p-6 border border-slate-200">
      <h2 className="text-xl font-semibold text-slate-900 mb-4">CCTV 모니터링</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {demoStreams.map((url, index) => (
          <div key={index} className="relative overflow-hidden rounded-[24px] border border-slate-200 shadow-sm bg-slate-950">
            <div className="bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100">
              카메라 {index + 1}
            </div>
            {index === 0 ? (
              <>
                <video
                  ref={(el) => (videoRefs.current[0] = el)}
                  className="w-full h-64 object-cover bg-black"
                  autoPlay
                  muted
                  playsInline
                >
                  브라우저가 비디오 태그를 지원하지 않습니다.
                </video>
                <button
                  onClick={() => toggleFullscreen(videoRefs.current[0])}
                  aria-label={`카메라 ${index + 1} 전체화면`}
                  className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-md p-2 text-xs"
                >
                  전체화면
                </button>
              </>
            ) : (
              <>
                <video
                  ref={(el) => (videoRefs.current[index] = el)}
                  className="w-full h-64 object-cover bg-black"
                  controls
                  src={url}
                >
                  브라우저가 비디오 태그를 지원하지 않습니다.
                </video>
                <button
                  onClick={() => toggleFullscreen(videoRefs.current[index])}
                  aria-label={`카메라 ${index + 1} 전체화면`}
                  className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-md p-2 text-xs"
                >
                  전체화면
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 text-sm text-gray-500">
        {webcamError ? (
          <p className="text-sm text-red-600">웹캠 접근 오류: {webcamError}</p>
        ) : (
          <p>※ 데모용 비디오입니다. 실제 카메라 연결 시 streamUrls prop으로 스트림 URL을 전달하세요.</p>
        )}
        <p>※ WebRTC, HLS, 또는 RTMP 스트리밍을 지원하도록 확장 가능합니다.</p>
      </div>
    </div>
  );
}