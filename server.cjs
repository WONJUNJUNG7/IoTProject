const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
let SerialPort;
let ReadlineParser;

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
const ARDUINO_PORT = 'COM3';
const BAUD_RATE = 9600;

let serialPort;
let parser;
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

// 시리얼 포트 연결 시도
function connectSerialPort() {
  try {
    // serialport가 설치되어 있지 않으면 require에서 에러가 발생하므로 안전히 처리
    try {
      SerialPort = require('serialport');
      ReadlineParser = require('@serialport/parser-readline').ReadlineParser;
    } catch (e) {
      console.warn('serialport 모듈을 로드할 수 없습니다. 더미 데이터로 동작합니다.');
      startDummyData();
      return;
    }

    serialPort = new SerialPort.SerialPort({
      path: ARDUINO_PORT,
      baudRate: BAUD_RATE
    });

    parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    serialPort.on('open', () => {
      console.log(`Serial port ${ARDUINO_PORT} connected at ${BAUD_RATE} baud`);
    });

    parser.on('data', (data) => {
      console.log('Arduino data received:', data);
      io.emit('arduino-data', data);
    });

    serialPort.on('error', (err) => {
      console.error('Serial port error:', err.message);
      startDummyData();
    });

    serialPort.on('close', () => {
      console.log('Serial port closed');
      startDummyData();
    });
  } catch (err) {
    console.error('Failed to connect serial port:', err.message);
    startDummyData();
  }
}

// 더미 데이터 생성 (5초마다) 및 stats/logs 갱신
function startDummyData() {
  if (dummyInterval) return;

  console.log('Starting dummy data generation...');
  const intervalMs = 5000; // 더 긴 지연
  dummyInterval = setInterval(() => {
    const speed = Math.floor(Math.random() * 100); // 0-99
    const shock = Math.floor(Math.random() * 50);
    const temp = (Math.random() * 40 + 10).toFixed(1);
    const humi = Math.floor(Math.random() * 100);
    const dummyData = `SPEED:${speed},SHOCK:${shock},TEMP:${temp},HUMI:${humi}`;

    // 상태 업데이트
    lastMeasuredSpeed = speed;
    // 차량 감지: speed > 0으로 간주
    if (speed > 0) {
      stats.todayDetected += 1;
      // speedLog 추가
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
    // stats 업데이트 이벤트도 전송
    io.emit('stats-update', stats);
  }, intervalMs);
}

// 소켓 연결 처리
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 클라이언트로부터 제어 명령 수신
  socket.on('control-bump', (command) => {
    console.log('Control command received:', command);
    
    if (serialPort && serialPort.isOpen) {
      serialPort.write(command + '\n', (err) => {
        if (err) {
          console.error('Failed to write to serial port:', err.message);
        } else {
          console.log('Command sent to Arduino:', command);
        }
      });
    } else {
      console.log('Serial port not available, command ignored');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  connectSerialPort();
});

// 서버 종료 시 정리
process.on('SIGINT', () => {
  if (dummyInterval) clearInterval(dummyInterval);
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }
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