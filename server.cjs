const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS']
  }
});

app.use(express.json());
// 간단한 CORS 헤더 (개발용) - 로컬 개발에서는 와일드카드 허용
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 간단한 mock 데이터 REST API
app.get('/api/devices', (req, res) => {
  // 전체 설치 장치 수를 1대로 고정하고, 현재 측정 속도를 반영
  const device = {
    id: 'BUMP-001',
    location: '테스트 방지턱',
    status: stats.operating === 1 ? '정상' : '오류',
    vehicleDetected: lastMeasuredSpeed > 0,
    currentSpeed: lastMeasuredSpeed,
    speedLimit: 30,
    bumpStatus: '대기 중',
    ledColor: '초록',
    buzzer: '정지',
    lastUpdate: new Date().toISOString(),
  };
  res.json([device]);
});

app.get('/api/event-logs', (req, res) => {
  res.json(eventLogs);
});

app.get('/api/speed-logs', (req, res) => {
  res.json(speedLogs);
});

app.get('/api/stats', (req, res) => {
  // 평균 속도 계산 (최근 로그 기반)
  const avgSpeed = speedLogs.length === 0 ? 0 : Math.round(speedLogs.reduce((sum, s) => sum + (s.measuredSpeed || 0), 0) / speedLogs.length);
  res.json({ ...stats, avgSpeed });
});

const PORT = 4000;

let dummyInterval;
// 런타임 통계와 로그(메모리 저장)
const stats = {
  totalDevices: 1,
  operating: 1,
  todayDetected: 0,
  overSpeed: 0,
};

let speedLogs = [];
let eventLogs = [];
let lastMeasuredSpeed = 0;

// ESP32의 데이터를 수신하는 HTTP POST 엔드포인트
app.post('/api/esp32-data', (req, res) => {
  try {
    const { speed, shock, temperature, humidity } = req.body;
    
    // 유효성 검사
    if (speed === undefined || shock === undefined || temperature === undefined || humidity === undefined) {
      return res.status(400).json({ error: 'Missing sensor data' });
    }

    // 데이터 포맷 변환 (기존 형식으로 통일)
    const formattedData = `SPEED:${speed},SHOCK:${shock},TEMP:${temperature},HUMI:${humidity}`;
    
    console.log('ESP32 data received:', formattedData);
    
    // 클라이언트에 실시간 데이터 전송
    io.emit('arduino-data', formattedData);
    
    // 상태 업데이트
    lastMeasuredSpeed = speed;
    
    // 차량 감지: speed > 0으로 간주
    if (speed > 0) {
      stats.todayDetected += 1;
      
      // speedLog 추가
      const speedLog = {
        id: `SPD-${Date.now()}`,
        detectedAt: new Date().toISOString(),
        location: 'ESP32 센서',
        measuredSpeed: speed,
        speedLimit: 30,
        judgment: speed > 30 ? '과속' : speed > 20 ? '주의' : '정상',
        bumpAction: speed > 30 ? '경고 발생' : '유지',
      };
      speedLogs.unshift(speedLog);
      if (speedLogs.length > 100) speedLogs.pop();

      // 과속 감지 시 이벤트 로그 추가
      if (speed > 30) {
        stats.overSpeed += 1;
        const evt = {
          id: `EVT-${Date.now()}`,
          occurredAt: new Date().toISOString(),
          deviceId: 'BUMP-001',
          location: 'ESP32 센서',
          eventType: '과속 감지',
          severity: '높음',
          status: '미확인',
        };
        eventLogs.unshift(evt);
        if (eventLogs.length > 100) eventLogs.pop();
      }
    }

    // stats 업데이트 이벤트 전송
    io.emit('stats-update', stats);
    
    res.json({ success: true, message: 'Data received successfully' });
  } catch (err) {
    console.error('Error processing ESP32 data:', err.message);
    res.status(500).json({ error: 'Failed to process data' });
  }
});

// 더미 데이터 생성 함수 (선택적 - 개발/테스트용)
// 필요하면 startDummyData()를 호출하여 활성화 가능
function startDummyData() {
  if (dummyInterval) return;

  console.log('Starting dummy data generation for testing...');
  const intervalMs = 5000; // 5초마다
  dummyInterval = setInterval(() => {
    const speed = Math.floor(Math.random() * 100); // 0-99
    const shock = Math.floor(Math.random() * 50);
    const temp = (Math.random() * 40 + 10).toFixed(1);
    const humi = Math.floor(Math.random() * 100);
    const dummyData = `SPEED:${speed},SHOCK:${shock},TEMP:${temp},HUMI:${humi}`;

    // 상태 업데이트
    lastMeasuredSpeed = speed;
    if (speed > 0) {
      stats.todayDetected += 1;
      const speedLog = {
        id: `SPD-${Date.now()}`,
        detectedAt: new Date().toISOString(),
        location: '테스트 위치',
        measuredSpeed: speed,
        speedLimit: 30,
        judgment: speed > 30 ? '과속' : speed > 20 ? '주의' : '정상',
        bumpAction: speed > 30 ? '경고 발생' : '유지',
      };
      speedLogs.unshift(speedLog);
      if (speedLogs.length > 100) speedLogs.pop();

      if (speed > 30) {
        stats.overSpeed += 1;
        const evt = {
          id: `EVT-${Date.now()}`,
          occurredAt: new Date().toISOString(),
          deviceId: 'BUMP-001',
          location: '테스트 위치',
          eventType: '과속 감지',
          severity: '높음',
          status: '미확인',
        };
        eventLogs.unshift(evt);
        if (eventLogs.length > 100) eventLogs.pop();
      }
    }

    console.log('Dummy data sent:', dummyData);
    io.emit('arduino-data', dummyData);
    io.emit('stats-update', stats);
  }, intervalMs);
}

// 소켓 연결 처리
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 클라이언트로부터 제어 명령 수신 (향후 ESP32 제어용)
  socket.on('control-bump', (command) => {
    console.log('Control command received:', command);
    // TODO: WiFi를 통해 ESP32에 제어 명령 전송
    // 예: HTTP 요청 또는 별도의 제어 엔드포인트 추가
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`ESP32 데이터 수신 엔드포인트: POST http://localhost:${PORT}/api/esp32-data`);
  // startDummyData(); // 필요시 테스트용 더미 데이터 활성화
});

// 서버 종료 시 정리
process.on('SIGINT', () => {
  if (dummyInterval) clearInterval(dummyInterval);
  server.close();
  console.log('Server closed');
  process.exit(0);
});


/* 나중에 아두이노 보드 연동 완료되면 이 코드를 사용 
COM 포트 번호 변경하는거 꼭 잊지마세요!!
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

// ⚠️ [체크포인트 1] 실제 아두이노가 연결된 COM 포트 번호로 꼭 변경하세요!
// (예: 윈도우는 'COM3', 'COM4' 등 / 맥북은 '/dev/tty.usbmodemXXXX')
const arduinoPort = new SerialPort({ path: 'COM3', baudRate: 9600 });
const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

// 1. 실제 아두이노가 센서 값을 보내면 웹사이트로 전달하는 로직
parser.on('data', (data) => {
  console.log('실제 아두이노 센서 데이터 수신:', data);
  // 웹사이트(localhost:5173)로 실시간 브로드캐스팅
  io.emit('arduino-data', data); 
});

// 2. 웹사이트에서 버튼을 누르면 아두이노로 명령을 보내는 로직
io.on('connection', (socket) => {
  console.log('관리자 웹사이트가 서버에 연결되었습니다.');

  socket.on('control-bump', (command) => {
    console.log('웹사이트로부터 제어 명령 수신:', command); // "UP" 또는 "DOWN"
    
    // 실제 아두이노 보드로 문자열 전송 (줄바꿈 포함)
    arduinoPort.write(command + '\n'); 
  });
});

server.listen(4000, () => {
  console.log('중계 서버가 4000번 포트에서 정상 작동 중입니다.');
});
*/