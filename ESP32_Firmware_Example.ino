#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===== WiFi 설정 =====
const char* SSID = "YOUR_WIFI_SSID";           // 변경: 사용할 WiFi 이름
const char* PASSWORD = "YOUR_WIFI_PASSWORD";   // 변경: WiFi 비밀번호

// ===== 서버 설정 =====
const char* SERVER_URL = "http://192.168.0.100:4000/api/esp32-data"; // 변경: 서버 IP 주소
const int SENSOR_READ_INTERVAL = 2000; // 센서 읽기 간격 (2초)

// ===== 센서 핀 설정 =====
const int SPEED_SENSOR_PIN = 34;      // 속도 센서 핀 (아날로그)
const int SHOCK_SENSOR_PIN = 35;      // 충격 센서 핀 (아날로그)
const int TEMP_SENSOR_PIN = 32;       // 온도 센서 핀 (아날로그)
const int HUMIDITY_SENSOR_PIN = 33;   // 습도 센서 핀 (아날로그)

unsigned long lastSensorReadTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== ESP32 Smart Bump Sensor ===");
  
  // WiFi 연결
  connectToWiFi();
}

void loop() {
  // WiFi 연결 상태 확인
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi 연결이 끊어졌습니다. 재연결 시도...");
    connectToWiFi();
    return;
  }
  
  // 센서 데이터 주기적으로 읽기 및 전송
  if (millis() - lastSensorReadTime >= SENSOR_READ_INTERVAL) {
    readAndSendSensorData();
    lastSensorReadTime = millis();
  }
  
  delay(100);
}

// ===== WiFi 연결 함수 =====
void connectToWiFi() {
  Serial.print("WiFi 연결 중: ");
  Serial.println(SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(SSID, PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi 연결 성공!");
    Serial.print("IP 주소: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi 연결 실패!");
  }
}

// ===== 센서 데이터 읽기 및 전송 함수 =====
void readAndSendSensorData() {
  // 아날로그 값 읽기 (0~4095)
  int speedRaw = analogRead(SPEED_SENSOR_PIN);
  int shockRaw = analogRead(SHOCK_SENSOR_PIN);
  int tempRaw = analogRead(TEMP_SENSOR_PIN);
  int humidityRaw = analogRead(HUMIDITY_SENSOR_PIN);
  
  // 실제 센서값으로 변환 (센서 종류에 따라 보정 필요)
  float speed = map(speedRaw, 0, 4095, 0, 100);              // 0~100 km/h
  float shock = map(shockRaw, 0, 4095, 0, 100);              // 0~100
  float temperature = (tempRaw / 4095.0) * 40 + 10;          // 10~50°C
  float humidity = map(humidityRaw, 0, 4095, 0, 100);        // 0~100%
  
  Serial.printf("센서 데이터 - Speed: %.1f, Shock: %.1f, Temp: %.1f, Humidity: %.1f\n", 
                speed, shock, temperature, humidity);
  
  // 데이터를 서버로 전송
  sendDataToServer(speed, shock, temperature, humidity);
}

// ===== 서버로 데이터 전송 함수 =====
void sendDataToServer(float speed, float shock, float temperature, float humidity) {
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  
  // JSON 데이터 생성
  StaticJsonDocument<200> jsonDoc;
  jsonDoc["speed"] = (int)speed;
  jsonDoc["shock"] = (int)shock;
  jsonDoc["temperature"] = temperature;
  jsonDoc["humidity"] = (int)humidity;
  
  String jsonString;
  serializeJson(jsonDoc, jsonString);
  
  // HTTP POST 요청 전송
  int httpCode = http.POST(jsonString);
  
  if (httpCode == 200) {
    Serial.println("✓ 데이터 전송 성공!");
  } else {
    Serial.print("✗ HTTP 에러 코드: ");
    Serial.println(httpCode);
  }
  
  http.end();
}

// ===== 선택사항: 서버에서 제어 명령 수신 함수 (향후 사용) =====
// void receiveControlCommand() {
//   HTTPClient http;
//   http.begin("http://192.168.0.100:4000/api/control");
//   int httpCode = http.GET();
//   
//   if (httpCode == 200) {
//     String command = http.getString();
//     Serial.print("제어 명령: ");
//     Serial.println(command);
//     // 명령에 따른 제어 로직 추가
//   }
//   http.end();
// }
