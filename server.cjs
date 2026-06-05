const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// CORS 헤더 설정
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- 변수 및 상태 관리 데이터 ---
const stats = {
  totalDevices: 1,
  operating: 1,
  todayDetected: 0,
  overSpeed: 0,
};
let speedLogs = [];
let eventLogs = [];
let lastMeasuredSpeed = 0; // 아두이노와 동일한 cm/s 단위를 저장합니다.
let currentTemp = '0.0';
let currentHumi = '0.0';
let currentShock = 0;
let currentStatus = 'READY';

// ⚠️ 아두이노 코드와 기준을 완벽히 일치시킵니다 (cm/s 기준)
const SPEED_LIMIT_CM_S = 50.0; 

// ⚠️ 아두이노 메가가 연결된 실제 COM 포트 번호로 꼭 적어주세요! (예: 'COM3', 'COM4')
const arduinoPort = new SerialPort({ path: 'COM3', baudRate: 9600 });
const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

// 아두이노가 시리얼 데이터를 던질 때마다 실행되는 구역
parser.on('data', (data) => {
  if (data.includes(',') && !data.includes('STATUS')) {
    try {
      const tokens = data.split(','); // 콤마 기준으로 쪼개기
      
      // 아두이노 main_2.ino의 sendToD1() 송출 순서 데이터 매칭
      currentStatus = tokens[0] || 'READY';
      
      // ⭐ 속도 차이의 원인이었던 단위를 아두이노 실측 속도 'cm/s'(3번째 값)로 고정합니다.
      const speed = parseFloat(tokens[2]);
      const validSpeed = !isNaN(speed) ? Math.round(speed * 10) / 10 : 0.0;

      currentTemp = tokens[8] || '0.0';             // 9번째 값: 온도
      currentHumi = tokens[9] || '0.0';             // 10번째 값: 습도
      currentShock = parseInt(tokens[12]) || 0;     // 13번째 값: 진동 센서값

      const isOverSpeed = parseInt(tokens[4]) === 1; // 과속 여부 (5번째 값)
      const isNfcEvent = parseInt(tokens[7]) === 1;  // NFC 이벤트 여부 (8번째 값)

      // 리액트 웹 대시보드용 데이터 포맷 규격 조립
      const formattedData = `SPEED:${validSpeed},SHOCK:${currentShock},TEMP:${currentTemp},HUMI:${currentHumi}`;
      console.log('🖥️ 웹사이트로 전달할 데이터:', formattedData);
      
      // 리액트로 실시간 전송!
      io.emit('arduino-data', formattedData);

      // --- 리액트 REST API 대시보드 내부 데이터 가공 로직 ---
      lastMeasuredSpeed = validSpeed;
      
      // 의미 있는 속도(움직임)가 감지되었을 때 로그 기록
      if (validSpeed > 10.0) { 
        stats.todayDetected += 1;
        const speedLog = {
          id: `SPD-${Date.now()}`,
          detectedAt: new Date().toISOString(),
          location: '아두이노 메가 센서',
          measuredSpeed: validSpeed,
          speedLimit: SPEED_LIMIT_CM_S, // 아두이노 기준인 50 cm/s로 일치
          judgment: isOverSpeed ? '과속' : validSpeed > 20.0 ? '주의' : '정상',
          bumpAction: isOverSpeed ? '경고 발생' : '유지',
        };
        speedLogs.unshift(speedLog);
        if (speedLogs.length > 100) speedLogs.pop();

        if (isOverSpeed) {
          stats.overSpeed += 1;
          const evt = {
            id: `EVT-${Date.now()}`,
            occurredAt: new Date().toISOString(),
            deviceId: 'BUMP-001',
            location: '아두이노 메가 센서',
            eventType: '과속 감지',
            severity: '높음',
            status: '미확인',
          };
          eventLogs.unshift(evt);
          if (eventLogs.length > 100) eventLogs.pop();
        }
      }

      // NFC 이벤트 발생 시 로그 기록
      if (isNfcEvent) {
        const evt = {
          id: `EVT-${Date.now()}`,
          occurredAt: new Date().toISOString(),
          deviceId: 'BUMP-001',
          location: 'NFC 서브보드',
          eventType: '긴급차량 감지(NFC)',
          severity: '긴급',
          status: '확인됨',
        };
        eventLogs.unshift(evt);
      }

      // 상태 업데이트 브로드캐스팅
      io.emit('stats-update', stats);

    } catch (err) {
      console.error('데이터 파싱 중 에러 발생:', err.message);
    }
  }
});

// --- 기존 리액트 컴포넌트 호환용 REST API 엔드포인트 ---
app.get('/api/devices', (req, res) => {
  const device = {
    id: 'BUMP-001',
    location: '테스트 방지턱',
    status: currentStatus === 'READY' ? '정상' : '확인 필요',
    vehicleDetected: lastMeasuredSpeed > 10.0,
    currentSpeed: lastMeasuredSpeed,
    speedLimit: SPEED_LIMIT_CM_S, 
    bumpStatus: currentStatus,
    ledColor: currentStatus === 'EMERGENCY' ? '빨강' : '초록',
    buzzer: currentStatus === 'EMERGENCY' ? '경보' : '정지',
    lastUpdate: new Date().toISOString(),
  };
  res.json([device]);
});

app.get('/api/event-logs', (req, res) => res.json(eventLogs));
app.get('/api/speed-logs', (req, res) => res.json(speedLogs));
app.get('/api/stats', (req, res) => {
  const avgSpeed = speedLogs.length === 0 ? 0 : Math.round(speedLogs.reduce((sum, s) => sum + (s.measuredSpeed || 0), 0) / speedLogs.length);
  res.json({ ...stats, avgSpeed });
});

// 웹사이트(리액트)에서 버튼을 눌렀을 때 아두이노 메가로 차단기 제어 명령 내리기
io.on('connection', (socket) => {
  console.log('✅ 리액트 웹사이트가 중계 서버에 연결되었습니다.');

  socket.on('control-bump', (command) => {
    console.log('🕹️ 웹사이트 제어 명령 수신:', command); 
    arduinoPort.write(command + '\n'); 
  });
  
  socket.on('disconnect', () => {
    console.log('❌ 리액트 웹사이트 연결 해제');
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 실제 아두이노 모드 서버가 http://localhost:${PORT} 에서 작동 중입니다.`);
});