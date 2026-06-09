import { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { ArduinoData } from '../types';

const SOCKET_SERVER_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : 'http://localhost:4000';

export function useArduinoData() {
  const [arduinoData, setArduinoData] = useState<ArduinoData>({
    speed: 0,
    shock: 0,
    temperature: 0,
    humidity: 0,
  });

  const [shockCount, setShockCount] = useState<number>(0);
  const shockActiveRef = useRef(false);
  const SHOCK_THRESHOLD = 400;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalDevices: number; operating: number; todayDetected: number; overSpeed: number } | null>(null);
  // 최근 측정 속도 버퍼를 유지해 실시간 평균 속도를 계산
  const speedsRef = useRef<number[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let socket: Socket;

    try {
      // 소켓 연결
      socket = io(SOCKET_SERVER_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socketRef.current = socket;

      // 연결 성공
      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        setIsConnected(true);
        setError(null);
      });

      // 'arduino-data' 이벤트 리스너
      socket.on('arduino-data', (data: string) => {
        try {
          // 데이터 파싱: "SPEED:50,SHOCK:12,TEMP:24,HUMI:60"
          const parsed = parseArduinoData(data);
          setArduinoData(parsed);

          // 충격 임계값 카운트: 400 이상에서 상승 엣지 감지 시만 +1
          const isShockAbove = parsed.shock >= SHOCK_THRESHOLD;
          if (isShockAbove && !shockActiveRef.current) {
            setShockCount((prev) => prev + 1);
          }
          shockActiveRef.current = isShockAbove;

          // 실시간 평균 속도 갱신: 0은 차량 미검출로 판단하여 제외
          const sp = parsed.speed;
          if (!isNaN(sp)) {
            if (sp > 0) {
              speedsRef.current.push(sp);
            }
            // 버퍼 크기 제한
            if (speedsRef.current.length > 50) {
              speedsRef.current.shift();
            }

            const nonZero = speedsRef.current.filter((v) => v > 0);
            const avg = nonZero.length === 0 ? 0 : Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length);
            setStats((prev) => ({
              // 보존: 기존 서버 통계가 있다면 유지하고, 없거나 값이 없는 경우 로컬값을 채움
              totalDevices: prev?.totalDevices ?? 0,
              operating: prev?.operating ?? 0,
              todayDetected: nonZero.length,
              overSpeed: prev?.overSpeed ?? 0,
              // @ts-ignore 추가적 필드로 avgSpeed 제공 (Admin에서 사용할 예정)
              avgSpeed: avg,
            } as any));
          }
        } catch (err) {
          console.error('아두이노 데이터 파싱 오류:', err);
          setError(`데이터 파싱 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
        }
      });

      // 'stats-update' 이벤트 리스너
          socket.on('stats-update', (s) => {
            // 서버에서 avgSpeed를 제공하지 않으면 로컬 버퍼로 계산해 병합
            const computeLocalAvg = () => {
              const nonZero = speedsRef.current.filter((v) => v > 0);
              return nonZero.length === 0 ? 0 : Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length);
            };

            const merged = { ...s } as any;
            if (merged.avgSpeed === undefined || merged.avgSpeed === null) {
              merged.avgSpeed = computeLocalAvg();
            }

            setStats(merged);
          });

      // 연결 끊김
      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      // 연결 오류
      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        setError(`연결 오류: ${err.message}`);
      });

      socket.on('control-bump-result', (result) => {
        console.log('Control bump result:', result);
        if (!result?.success) {
          setError(`제어 실패: ${result?.error ?? '알 수 없는 오류'}`);
        }
      });

      return () => {
        socket.off('connect');
        socket.off('arduino-data');
        socket.off('stats-update');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('control-bump-result');
        socket.disconnect();
        socketRef.current = null;
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '소켓 연결 실패';
      console.error('Socket connection failed:', err);
      setError(errorMsg);
    }
  }, []);

  // initial fetch for stats if available
  useEffect(() => {
    let mounted = true;
    fetch(`${SOCKET_SERVER_URL}/api/stats`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!mounted) return;
        if (data) setStats(data);
      })
      .catch(() => {});

    return () => { mounted = false; };
  }, []);

  /**
   * 방지턱 원격 제어
   * @param command 'UP' 또는 'DOWN'
   */
  const controlBump = (command: 'UP' | 'DOWN') => {
    if (!socketRef.current || !isConnected) {
      console.warn('소켓이 연결되지 않았습니다.');
      setError('소켓이 연결되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      socketRef.current.emit('control-bump', command);
      console.log(`방지턱 제어 명령 전송: ${command}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '전송 실패';
      console.error('방지턱 제어 오류:', err);
      setError(`제어 오류: ${errorMsg}`);
    }
  };

  return {
    arduinoData,
    shockCount,
    isConnected,
    error,
    controlBump,
    stats,
  };
}

/**
 * 아두이노 데이터 문자열 파싱
 * 입력 형식: "SPEED:50,SHOCK:12,TEMP:24,HUMI:60"
 */
function parseArduinoData(dataStr: string): ArduinoData {
  const result: ArduinoData = {
    speed: 0,
    shock: 0,
    temperature: 0,
    humidity: 0,
  };

  try {
    // 쉼표로 분리
    const parts = dataStr.split(',');

    for (const part of parts) {
      const [key, value] = part.trim().split(':');
      const numValue = parseFloat(value);

      if (isNaN(numValue)) {
        throw new Error(`잘못된 값: ${part}`);
      }

      switch (key.trim().toUpperCase()) {
        case 'SPEED':
          result.speed = numValue;
          break;
        case 'SHOCK':
          result.shock = numValue;
          break;
        case 'TEMP':
          result.temperature = numValue;
          break;
        case 'HUMI':
          result.humidity = numValue;
          break;
        default:
          console.warn(`알 수 없는 키: ${key}`);
      }
    }

    return result;
  } catch (err) {
    throw new Error(`데이터 파싱 실패: ${dataStr} - ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
  }
}
