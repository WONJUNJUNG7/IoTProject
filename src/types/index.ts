// 스마트 방지턱 시스템에서 공통으로 쓰는 타입 정의

export type DeviceStatus = '정상' | '대기' | '오류';
export type BumpStatus = '내려감' | '올라감' | '대기 중' | '오류';
export type LedColor = '초록' | '노랑' | '빨강';
export type BuzzerStatus = '작동' | '정지';

export type SpeedJudgment = '정상' | '주의' | '과속';
export type BumpAction = '유지' | '상승' | '경고 발생';

export type EventType =
  | '과속 감지'
  | '센서 오류'
  | '모터 오류'
  | '통신 오류'
  | '전원 부족';
export type EventSeverity = '낮음' | '보통' | '높음';
export type EventStatus = '미확인' | '확인 완료';

// 부속 장치 상태
export type SensorStatus = '정상' | '오류';
export type ActuatorStatus = '정상' | '오류';
export type PowerStatus = '정상' | '낮음' | '오류';
export type NetworkStatus = '연결' | '끊김';

// 방지턱 장치
export interface Device {
  id: string;
  location: string;          // 설치 위치
  status: DeviceStatus;      // 종합 상태
  vehicleDetected: boolean;  // 현재 차량 감지 여부
  currentSpeed: number;      // 현재 측정 속도(km/h)
  speedLimit: number;        // 제한 속도(km/h)
  bumpStatus: BumpStatus;
  ledColor: LedColor;
  buzzer: BuzzerStatus;
  lastUpdate: string;        // ISO 문자열
  sensorStatus: SensorStatus;
  actuatorStatus: ActuatorStatus;
  powerStatus: PowerStatus;
  networkStatus: NetworkStatus;
  firmwareVersion: string;
}

// 차량 속도 감지 기록
export interface SpeedLog {
  id: string;
  detectedAt: string;        // 감지 시간
  location: string;
  measuredSpeed: number;
  speedLimit: number;
  judgment: SpeedJudgment;
  bumpAction: BumpAction;
}

// 경고 / 이벤트 로그
export interface EventLog {
  id: string;
  occurredAt: string;
  deviceId: string;
  location: string;
  eventType: EventType;
  severity: EventSeverity;
  status: EventStatus;
}

// 사이드바 메뉴 키
export type MenuKey =
  | 'dashboard'
  | 'realtime'
  | 'speedLog'
  | 'eventLog'
  | 'devices'
  | 'control'
  | 'cctv'
  | 'settings';

// 아두이노 실시간 데이터
export interface ArduinoData {
  speed: number;
  shock: number;
  temperature: number;
  humidity: number;
}
