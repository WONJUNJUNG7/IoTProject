const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const cors = require('cors');
const axios = require('axios'); // 💡 Wemos D1에 HTTP 요청을 보내기 위해 axios 라이브러리 포함

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

// Wemos D1 보드의 WiFi 제어 엔드포인트. 실제 D1 IP 주소로 변경하세요.
const D1_TARGET_URL = process.env.D1_TARGET_URL || "http://10.156.158.226";

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

// 🔌 아두이노 시리얼 포트 경로: D1 WiFi만 사용할 때는 비워두거나 환경 변수로 설정하세요.
const SERIAL_PORT_PATH = process.env.SERIAL_PORT_PATH || "COM3";
const ENABLE_USB_SERIAL = process.env.ENABLE_USB_SERIAL !== 'false';
let arduinoPort = null;
let parser = null;
// 마지막으로 콘솔에 출력한 시간(밀리초)
let lastConsoleLogTime = 0;
// 감지 중복 방지 쿨다운(ms): 같은 차량의 연속 측정을 하나로 처리하기 위해 사용
// 기본값을 5000ms(5초)로 설정
const DETECTION_COOLDOWN_MS = parseInt(process.env.DETECTION_COOLDOWN_MS || '5000', 10);
let lastDetectionTime = 0;

if (ENABLE_USB_SERIAL && SERIAL_PORT_PATH) {
  try {
    arduinoPort = new SerialPort({ path: SERIAL_PORT_PATH, baudRate: 9600, autoOpen: false });
    parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    arduinoPort.open((err) => {
      if (err) {
        console.warn(`⚠️ 시리얼 포트 ${SERIAL_PORT_PATH} 열기 실패:`, err.message);
        arduinoPort = null;
        parser = null;
      } else {
        console.log(`✅ 시리얼 포트 ${SERIAL_PORT_PATH} 연결됨`);
      }
    });
  } catch (err) {
    console.warn(`⚠️ 시리얼 포트 ${SERIAL_PORT_PATH} 초기화 실패:`, err.message);
    arduinoPort = null;
    parser = null;
  }
} else if (!ENABLE_USB_SERIAL) {
  console.log('ℹ️ USB 시리얼 제어가 비활성화되어 있습니다. D1 WiFi 경로만 사용합니다.');
} else {
  console.log('ℹ️ SERIAL_PORT_PATH가 설정되지 않아 아두이노 시리얼 연결을 생략합니다.');
}

if (parser) {
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
        
        // 리액트로 실시간 전송 (항상 전송)
        io.emit('arduino-data', formattedData);

        // VSCode 터미널에는 5초에 한 번만 출력하도록 제한
        const now = Date.now();
        if (now - lastConsoleLogTime >= 5000) {
          console.log('🖥️ 웹사이트로 전달할 데이터:', formattedData);
          lastConsoleLogTime = now;
        }

        // --- 리액트 REST API 대시보드 내부 데이터 가공 로직 ---
        lastMeasuredSpeed = validSpeed;
        
        // 의미 있는 속도(움직임)가 감지되었을 때 로그 기록
        if (validSpeed > 10.0) {
          // 중복 감지 방지: 마지막 감지 이후 일정 시간(쿨다운) 경과 시만 카운트
          if (now - lastDetectionTime >= DETECTION_COOLDOWN_MS) {
            lastDetectionTime = now;
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
} else {
  console.log('ℹ️ 아두이노 시리얼 파서(parser)가 준비되지 않았습니다.');
}

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

// ====================================================================
// 🌟 리액트 대시보드 버튼(방지턱 강제 올림/내림) 연동 API (REST 방식)
// ====================================================================
app.post('/api/bump', async (req, res) => {
  const val = req.query.val; 
  let angle = 0;
  let command = '';

  if (val === '1') {
    angle = 0;        
    command = 'OPEN'; 
  } else if (val === '0') {
    angle = 180;      
    command = 'CLOSE'; 
  } else {
    return res.status(400).json({ success: false, message: "잘못된 요청 값입니다." });
  }

  try {
    if (ENABLE_USB_SERIAL && arduinoPort && arduinoPort.isOpen) {
      arduinoPort.write(command + '\n');
      console.log(`🔌 [REST] 아두이노 메가 시리얼 명령 전송: ${command}`);
    } else if (!ENABLE_USB_SERIAL) {
      console.log('ℹ️ USB 시리얼 제어가 비활성화되어 있어 아두이노 시리얼은 건너뜁니다.');
    }

    const d1Path = `/servo?angle=${angle}`;
    console.log(`🌐 [REST] Wemos D1 보드로 신호 전송 중... (${command}) -> ${D1_TARGET_URL}${d1Path}`);
    await axios.get(`${D1_TARGET_URL}${d1Path}`);
    console.log(`📬 [REST] Wemos D1 서보모터 신호 전달 완료!`);
    
    res.json({ success: true, message: `방지턱 ${command} 제어 성공 (${angle}도)` });
  } catch (error) {
    console.error('❌ [REST] 방지턱 제어 중 오류 발생:', error.message);
    if (error.response) {
      console.error('   response status:', error.response.status);
      console.error('   response data:', error.response.data);
    }
    if (error.code) {
      console.error('   error code:', error.code);
    }
    res.status(500).json({ success: false, message: "D1 보드 또는 아두이노 연결 상태 확인 필요" });
  }
});

app.get('/api/servo', async (req, res) => {
  const angle = parseInt(req.query.angle, 10);
  if (Number.isNaN(angle) || angle < 0 || angle > 180) {
    return res.status(400).json({ success: false, message: 'angle 쿼리는 0~180 사이 정수여야 합니다.' });
  }

  const results = [];

  try {
    if (ENABLE_USB_SERIAL && arduinoPort && arduinoPort.isOpen) {
      const cmd = `ANGLE=${angle}\n`;
      arduinoPort.write(cmd);
      console.log(`🔌 [REST] USB(COM3)로 각도 명령 전송: ${cmd.trim()}`);
      results.push('USB OK');
    } else if (!ENABLE_USB_SERIAL) {
      results.push('USB DISABLED');
      console.log('ℹ️ USB 시리얼 제어가 비활성화되어 있어 USB 각도 전송은 건너뜁니다.');
    } else {
      results.push('USB SKIPPED');
    }
  } catch (err) {
    console.error('❌ [REST] USB(COM3) 각도 전송 중 오류 발생:', err.message);
    results.push('USB FAIL');
  }

  try {
    const d1Path = `/servo?angle=${angle}`;
    console.log(`🌐 [REST] Wemos D1 보드로 서보 각도 전송 중... -> ${D1_TARGET_URL}${d1Path}`);
    await axios.get(`${D1_TARGET_URL}${d1Path}`);
    console.log(`📬 [REST] Wemos D1 서보 각도 ${angle} 전달 완료!`);
    results.push('WIFI OK');
  } catch (error) {
    console.error('❌ [REST] D1 서보 각도 전송 중 오류 발생:', error.message);
    if (error.response) {
      console.error('   response status:', error.response.status);
      console.error('   response data:', error.response.data);
    }
    if (error.code) {
      console.error('   error code:', error.code);
    }
    results.push('WIFI FAIL');
  }

  const success = results.some((value) => value.endsWith('OK'));
  if (!success) {
    return res.status(500).json({ success: false, message: 'USB와 WiFi 모두 실패했습니다.', detail: results });
  }

  res.json({ success: true, message: `서보 각도 ${angle}도로 설정되었습니다.`, detail: results });
});

// ====================================================================
// 🔄 리액트 소켓 우회 연동 로직 (현재 질문하신 로그 해결 핵심 구역)
// ====================================================================
io.on('connection', (socket) => {
  console.log('✅ 리액트 웹사이트가 중계 서버에 연결되었습니다.');

  // 리액트 브라우저가 옛날 소켓 코드로 'UP' 또는 'DOWN'을 보낼 때 작동합니다.
  socket.on('control-bump', async (command) => {
    console.log('🕹️ 웹사이트 제어 명령 수신:', command); 
    
    let angle = 0;
    let megaCommand = '';

    if (command === 'UP') {
      angle = 0;
      megaCommand = 'OPEN';
    } else if (command === 'DOWN') {
      angle = 90;
      megaCommand = 'CLOSE';
    } else {
      // 만약 기존 주소 방식('OPEN'/'CLOSE')이 들어와도 메가로 그냥 포워딩해 주는 안전장치
      if (arduinoPort && arduinoPort.isOpen) {
        arduinoPort.write(command + '\n');
        console.log(`🔌 [소켓 우회] 아두이노 메가 시리얼 명령 전송: ${command}`);
      } else {
        console.log('ℹ️ 아두이노 시리얼 연결이 없어 시리얼 포워딩을 건너뜁니다.');
      }
      return;
    }

    try {
      // 1. 아두이노 메가 제어
      if (arduinoPort && arduinoPort.isOpen) {
        arduinoPort.write(megaCommand + '\n');
        console.log(`🔌 [소켓 우회] 아두이노 메가 시리얼 명령 전송: ${megaCommand}`);
      }

      // 2. 와이파이를 통해 Wemos D1 보드 제어
      const d1Path = `/servo?angle=${angle}`;
      console.log(`🌐 [소켓 우회] Wemos D1 보드로 신호 전송 중... (${megaCommand}) -> ${D1_TARGET_URL}${d1Path}`);
      
      await axios.get(`${D1_TARGET_URL}${d1Path}`);
      console.log(`📬 [소켓 우회] Wemos D1 서보모터 신호 전달 완료!`);

    } catch (error) {
      console.error('❌ [소켓 우회] 방지턱 제어 중 오류 발생:', error.message);
      if (error.response) {
        console.error('   response status:', error.response.status);
        console.error('   response data:', error.response.data);
      }
      if (error.code) {
        console.error('   error code:', error.code);
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ 리액트 웹사이트 연결 해제');
  });
});

const PORT = parseInt(process.env.PORT || '4000', 10);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ 포트 ${PORT}가 이미 사용 중입니다. 다른 서버가 실행 중인지 확인하세요.`);
    console.error('   Windows의 경우: netstat -ano | findstr ":4000"');
    console.error('   현재 실행 중인 프로세스를 종료하려면: taskkill /F /PID <PID>');
    process.exit(1);
  }
  console.error('❌ 서버 오류 발생:', err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`🚀 실제 아두이노 모드 서버가 http://localhost:${PORT} 에서 작동 중입니다.`);
});