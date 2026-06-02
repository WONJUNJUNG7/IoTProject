# ESP32 WiFi 연결 설정 가이드

## 📋 개요
기존 Arduino 직렬 연결에서 **WiFi(HTTP/REST)** 방식으로 변경했습니다.
이제 ESP32는 WiFi를 통해 HTTP POST 요청으로 센서 데이터를 서버에 전송합니다.

## 🔧 서버 수정 사항

### 1. **기존 직렬 포트 연결 제거**
- `server.cjs`에서 SerialPort 관련 코드 모두 제거
- USB/COM 포트 연결 불필요

### 2. **새로운 HTTP 엔드포인트 추가**
```
POST http://localhost:4000/api/esp32-data
```

**요청 형식 (JSON):**
```json
{
  "speed": 45,
  "shock": 12,
  "temperature": 25.5,
  "humidity": 60
}
```

**응답:**
```json
{
  "success": true,
  "message": "Data received successfully"
}
```

---

## 📱 ESP32 펌웨어 설정

### 1. **Arduino IDE 설치**
- [Arduino IDE 다운로드](https://www.arduino.cc/en/software) (v1.8.x 이상)

### 2. **필요한 라이브러리 설치**
Arduino IDE에서: `스케치` → `라이브러리 포함하기` → `라이브러리 관리자`

설치할 라이브러리:
- **WiFi** (ESP32 내장 - 별도 설치 불필요)
- **HTTPClient** (ESP32 내장)
- **ArduinoJson** (검색 → `ArduinoJson by Benoit Blanchon` 설치)

### 3. **ESP32 보드 설정**
1. `파일` → `환경설정`에서 **Additional Boards Manager URLs** 추가:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```

2. `도구` → `보드` → `보드 관리자` → `esp32` 검색 → 설치

3. 보드 선택:
   - `도구` → `보드` → `ESP32 Arduino` → `ESP32 Dev Module` (또는 사용하는 보드)

### 4. **포트 및 통신속도 설정**
- `도구` → `포트` → ESP32가 연결된 COM 포트 선택
- `도구` → `Upload Speed` → `115200` 설정

---

## 🔑 펌웨어 코드 수정

`ESP32_Firmware_Example.ino` 파일을 열고 다음을 수정하세요:

```cpp
// ===== WiFi 설정 =====
const char* SSID = "YOUR_WIFI_SSID";           // ← 사용할 WiFi 이름
const char* PASSWORD = "YOUR_WIFI_PASSWORD";   // ← WiFi 비밀번호

// ===== 서버 설정 =====
const char* SERVER_URL = "http://192.168.0.100:4000/api/esp32-data"; // ← 서버 IP 변경
```

### 📌 서버 IP 주소 찾기

**Windows PowerShell에서:**
```powershell
ipconfig
```

출력에서 `IPv4 Address: 192.168.x.x` 형태의 IP 주소 복사

**예시:**
```cpp
const char* SERVER_URL = "http://192.168.0.100:4000/api/esp32-data";
```

---

## 🚀 실행 단계

### 1. **Node.js 서버 시작**
```bash
npm run dev
```

콘솔에 이렇게 표시되면 성공:
```
Server is running on http://localhost:4000
ESP32 데이터 수신 엔드포인트: POST http://localhost:4000/api/esp32-data
```

### 2. **ESP32에 펌웨어 업로드**
1. Arduino IDE에서 `스케치` → `업로드` (또는 `Ctrl+U`)
2. 업로드 완료 후 자동으로 재시작

### 3. **시리얼 모니터에서 확인**
`도구` → `시리얼 모니터` (115200 보드레이트)

```
=== ESP32 Smart Bump Sensor ===
WiFi 연결 중: YOUR_WIFI_SSID
...
WiFi 연결 성공!
IP 주소: 192.168.x.xxx
센서 데이터 - Speed: 45.0, Shock: 12.0, Temp: 25.5, Humidity: 60.0
✓ 데이터 전송 성공!
```

---

## ✅ 웹 대시보드 확인

브라우저에서 열기: **http://localhost:5173**

- 실시간 센서 데이터 표시
- 속도, 충격, 온도, 습도 모니터링
- 과속 감지 및 이벤트 로그 기록

---

## 🛠️ 센서 연결 (선택사항)

ESP32의 아날로그 핀에 센서 연결:
- **GPIO34**: 속도 센서
- **GPIO35**: 충격 센서  
- **GPIO32**: 온도 센서
- **GPIO33**: 습도 센서

또는 테스트용으로 아날로그 입력 없이 더미 값으로 시뮬레이션할 수 있습니다.

---

## 🔍 문제 해결

### WiFi 연결 실패
- SSID와 비밀번호 확인
- ESP32와 PC가 같은 WiFi 네트워크에 연결되었는지 확인

### 데이터 전송 실패
- 서버 IP 주소가 맞는지 확인 (`ipconfig`)
- 방화벽에서 4000 포트가 차단되지 않았는지 확인
- 서버가 정상적으로 실행 중인지 확인 (`npm run dev`)

### 시리얼 모니터 출력 안 됨
- 보드레이트가 115200으로 설정되었는지 확인
- USB 케이블 연결 재확인

---

## 📝 다음 단계

1. **실제 센서 연결**: 현재는 아날로그 입력을 무작위 값으로 시뮬레이션하고 있습니다
2. **센서 보정**: 각 센서의 최소/최대 값에 맞게 `map()` 함수 수정
3. **제어 기능**: ESP32에서 LED, 부저 등 액추에이터 제어 추가

---

**작성일**: 2026년 6월 2일  
**프로젝트**: Smart Bump Detection System
