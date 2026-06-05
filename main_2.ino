#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <Servo.h>

// =====================================================
// 메인 보드 코드
// 역할:
// 1. 초음파 센서로 속도 측정
// 2. 속도에 따라 서보모터 제어
// 3. 진동 센서 / DHT11 센서 확인
// 4. 서브보드 NFC 감지 신호 수신
// 5. LCD 1개에 속도 / 상태 출력
// 6. D1 WiFi 보드로 데이터 전송
//
// Arduino Mega 기준
// =====================================================

// =====================================================
// LCD 1개 설정
// =====================================================
// 메인보드에서는 속도 / 시스템 상태 LCD만 제어합니다.
// 두 번째 LCD는 NFC 서브보드가 제어합니다.
LiquidCrystal_I2C lcdSpeed(0x27, 16, 2);

// =====================================================
// 외부 NFC 서브보드 입력 설정
// =====================================================
// 서브보드 코드 기준:
// 평상시 LOW
// NFC 인식 시 D7 HIGH 1초 출력
//
// 연결:
// NFC 서브보드 D7  -> Arduino Mega D6
// NFC 서브보드 GND -> Arduino Mega GND
const int EXT_NFC_SIGNAL_PIN = 6;
const int EXT_NFC_ACTIVE_LEVEL = HIGH;

// 외부 NFC 입력 디바운스 / 중복 감지 방지 시간
const unsigned long EXT_NFC_DEBOUNCE_MS = 80;
const unsigned long EXT_NFC_EVENT_COOLDOWN_MS = 2500;

// =====================================================
// 초음파 센서 핀 설정
// Arduino Mega 기준
// =====================================================
const int TRIG1 = 22;
const int ECHO1 = 23;
const int TRIG2 = 24;
const int ECHO2 = 25;

// =====================================================
// 진동 센서 핀 설정
// =====================================================
const int VIB_PIN = A0;

// =====================================================
// DHT11 온습도 센서 설정
// =====================================================
#define DHTPIN 26
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// =====================================================
// 서보모터 핀 설정
// =====================================================
const int SERVO_PIN = 8;
Servo bumpServo;

// =====================================================
// 시스템 설정값
// =====================================================

// 초음파 센서 1번과 2번 사이 실제 거리(cm)
// 실제 설치 거리와 반드시 맞춰야 합니다.
const float SENSOR_DISTANCE_CM = 50.0;

// 차량 감지 기준 거리(cm)
const float DETECT_THRESHOLD_CM = 20.0;

// 속도 판단 기준
// 단위: cm/s
const float SPEED_SAFE_MIN_CM_S = 20.0;
const float SPEED_LIMIT_CM_S    = 50.0;
const float SPEED_CRITICAL_CM_S = 70.0;

// 서보모터 단계별 각도
const int SERVO_STAGE_0 = 0;
const int SERVO_STAGE_1 = 10;
const int SERVO_STAGE_2 = 20;
const int SERVO_STAGE_3 = 30;

// 진동 센서 충격 감지 기준값
const int VIB_THRESHOLD = 600;

// 속도 측정 제한 시간
const unsigned long MEASURE_TIMEOUT_MS = 5000;

// 초음파 pulseIn 최대 대기 시간
const unsigned long ULTRASONIC_TIMEOUT_US = 25000;

// =====================================================
// 주기 설정
// =====================================================
const unsigned long DHT_INTERVAL_MS = 2000;
const unsigned long SERIAL_INTERVAL_MS = 2000;
const unsigned long D1_INTERVAL_MS = 500;
const unsigned long LCD_READY_INTERVAL_MS = 1000;

// 이벤트 화면 유지 시간
const unsigned long RESULT_DISPLAY_MS = 2500;
const unsigned long IMPACT_DISPLAY_MS = 2500;
const unsigned long EMERGENCY_DISPLAY_MS = 2500;
const unsigned long TIMEOUT_DISPLAY_MS = 1500;

// 충격 감지 쿨다운
const unsigned long IMPACT_COOLDOWN_MS = 2000;

// =====================================================
// 시스템 상태 정의
// =====================================================
enum SystemState {
  STATE_READY,
  STATE_MEASURING,
  STATE_SAFE,
  STATE_OVER_SPEED,
  STATE_CRITICAL_SPEED,
  STATE_IMPACT,
  STATE_EMERGENCY,
  STATE_TIMEOUT
};

SystemState currentState = STATE_READY;

// =====================================================
// 측정 변수
// =====================================================
float dist1 = 999.0;
float dist2 = 999.0;

float lastSpeedCmS = 0.0;
float lastSpeedKmh = 0.0;

int speedStage = 0;
// 0: 정지/매우 느림
// 1: 정상
// 2: 과속
// 3: 위험 과속

int vibValue = 0;

float temperature = 0.0;
float humidity = 0.0;

bool isMeasuring = false;

bool impactEvent = false;
bool nfcEvent = false;
bool overSpeedEvent = false;
bool criticalSpeedEvent = false;

// 외부 NFC 입력 상태 변수
bool extNfcSignalActive = false;
int lastExtNfcRaw = LOW;
int stableExtNfcState = LOW;
unsigned long lastExtNfcChangeTime = 0;
unsigned long lastExtNfcEventTime = 0;

unsigned long startMeasureTime = 0;
unsigned long stateStartTime = 0;

// =====================================================
// 타이머 변수
// =====================================================
unsigned long lastDhtTime = 0;
unsigned long lastSerialTime = 0;
unsigned long lastD1Time = 0;
unsigned long lastReadyLcdTime = 0;
unsigned long lastImpactTime = 0;

// =====================================================
// 함수 선언
// =====================================================
void initLCD();
void initExternalNFCInput();

float getDistanceOnce(int trigPin, int echoPin);
float getDistanceAverage(int trigPin, int echoPin, int samples);

void updateSensors();
void updateDHT();
void updateExternalNFCInput();
void updateSpeedMeasure();
void updateTimeout();
void updateEventState();

void handleImpact();
void handleEmergencyVehicle();
void handleSpeedResult(float speedCmS);

void setState(SystemState newState);
const char* getStateText();

void showReady();
void showMeasuring();
void showSpeedResult();
void showImpact();
void showEmergency();
void showTimeout();

void printStatus();
void sendToD1();

// =====================================================
// setup
// =====================================================
void setup() {
  Serial.begin(9600);

  // Arduino Mega 기준 Serial1
  // TX1 = 18번, RX1 = 19번
  // D1 WiFi 보드와 통신할 때 GND 공통 필수
  //
  // 권장 연결:
  // Mega TX1(18) -> 레벨 변환 또는 전압분배 -> D1 RX
  // Mega RX1(19) <- D1 TX
  // Mega GND     <-> D1 GND
  Serial1.begin(9600);

  pinMode(TRIG1, OUTPUT);
  pinMode(ECHO1, INPUT);
  pinMode(TRIG2, OUTPUT);
  pinMode(ECHO2, INPUT);
  pinMode(VIB_PIN, INPUT);

  bumpServo.attach(SERVO_PIN);
  bumpServo.write(SERVO_STAGE_0);

  dht.begin();

  initLCD();
  initExternalNFCInput();

  Serial.println("================================");
  Serial.println("SMART BUMP SYSTEM BOOT");
  Serial.println("Board: Arduino Mega 2560");
  Serial.println("NFC: External sub board input mode");
  Serial.println("LCD: Main speed LCD only");
  Serial.println("D1: Serial1 data send mode");
  Serial.println("Speed Stage: 0 / 1 / 2 / 3");
  Serial.println("================================");

  setState(STATE_READY);
  showReady();

  Serial.println("SYSTEM READY");
}

// =====================================================
// loop
// =====================================================
void loop() {
  updateSensors();
  updateDHT();
  updateExternalNFCInput();

  updateSpeedMeasure();
  updateTimeout();
  updateEventState();

  printStatus();
  sendToD1();
}

// =====================================================
// LCD 1개 초기화
// =====================================================
void initLCD() {
  lcdSpeed.init();
  lcdSpeed.backlight();

  lcdSpeed.clear();
  lcdSpeed.setCursor(0, 0);
  lcdSpeed.print("Smart Bump");
  lcdSpeed.setCursor(0, 1);
  lcdSpeed.print("Main LCD");

  delay(1500);

  lcdSpeed.clear();
}

// =====================================================
// 외부 NFC 입력 초기화
// =====================================================
void initExternalNFCInput() {
  // NFC 서브보드가 평상시 LOW, 인식 시 HIGH를 직접 출력하는 구조
  pinMode(EXT_NFC_SIGNAL_PIN, INPUT);

  lastExtNfcRaw = digitalRead(EXT_NFC_SIGNAL_PIN);
  stableExtNfcState = lastExtNfcRaw;
  extNfcSignalActive = (stableExtNfcState == EXT_NFC_ACTIVE_LEVEL);

  Serial.print("[EXT NFC] Signal pin: D");
  Serial.println(EXT_NFC_SIGNAL_PIN);
  Serial.println("[EXT NFC] Standby: LOW / Detected: HIGH");
}

// =====================================================
// 초음파 1회 거리 측정
// =====================================================
float getDistanceOnce(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, ULTRASONIC_TIMEOUT_US);

  if (duration == 0) {
    return 999.0;
  }

  float distance = duration * 0.0343 / 2.0;
  return distance;
}

// =====================================================
// 초음파 평균 거리 측정
// =====================================================
float getDistanceAverage(int trigPin, int echoPin, int samples) {
  float sum = 0.0;
  int validCount = 0;

  for (int i = 0; i < samples; i++) {
    float d = getDistanceOnce(trigPin, echoPin);

    if (d > 0 && d < 400) {
      sum += d;
      validCount++;
    }

    delayMicroseconds(500);
  }

  if (validCount == 0) {
    return 999.0;
  }

  return sum / validCount;
}

// =====================================================
// 센서값 업데이트
// =====================================================
void updateSensors() {
  vibValue = analogRead(VIB_PIN);

  dist1 = getDistanceAverage(TRIG1, ECHO1, 2);
  dist2 = getDistanceAverage(TRIG2, ECHO2, 2);

  if (vibValue > VIB_THRESHOLD) {
    if (millis() - lastImpactTime >= IMPACT_COOLDOWN_MS) {
      handleImpact();
      lastImpactTime = millis();
    }
  }
}

// =====================================================
// DHT11 온습도 업데이트
// =====================================================
void updateDHT() {
  if (millis() - lastDhtTime < DHT_INTERVAL_MS) {
    return;
  }

  lastDhtTime = millis();

  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (!isnan(h) && !isnan(t)) {
    humidity = h;
    temperature = t;
  } else {
    Serial.println("[DHT] Read failed");
  }
}

// =====================================================
// 외부 NFC 입력 업데이트
// =====================================================
void updateExternalNFCInput() {
  int raw = digitalRead(EXT_NFC_SIGNAL_PIN);
  unsigned long now = millis();

  if (raw != lastExtNfcRaw) {
    lastExtNfcRaw = raw;
    lastExtNfcChangeTime = now;
  }

  if ((now - lastExtNfcChangeTime) >= EXT_NFC_DEBOUNCE_MS) {
    if (stableExtNfcState != raw) {
      stableExtNfcState = raw;
      extNfcSignalActive = (stableExtNfcState == EXT_NFC_ACTIVE_LEVEL);

      // LOW -> HIGH 순간을 NFC 감지 이벤트로 처리
      if (extNfcSignalActive) {
        if (now - lastExtNfcEventTime >= EXT_NFC_EVENT_COOLDOWN_MS) {
          lastExtNfcEventTime = now;
          handleEmergencyVehicle();
        }
      }
    }
  }
}

// =====================================================
// 속도 측정 업데이트
// =====================================================
void updateSpeedMeasure() {
  if (
    currentState == STATE_IMPACT ||
    currentState == STATE_EMERGENCY ||
    currentState == STATE_TIMEOUT ||
    currentState == STATE_SAFE ||
    currentState == STATE_OVER_SPEED ||
    currentState == STATE_CRITICAL_SPEED
  ) {
    return;
  }

  if (!isMeasuring && dist1 < DETECT_THRESHOLD_CM) {
    isMeasuring = true;
    startMeasureTime = millis();

    setState(STATE_MEASURING);
    showMeasuring();

    Serial.println("[SPEED] Sensor1 detected");
    Serial.println("[SPEED] Measuring start");
  }

  if (isMeasuring && dist2 < DETECT_THRESHOLD_CM) {
    unsigned long endTime = millis();
    float timeTakenSec = (endTime - startMeasureTime) / 1000.0;

    if (timeTakenSec <= 0.0) {
      isMeasuring = false;
      setState(STATE_READY);
      showReady();
      return;
    }

    float speedCmS = SENSOR_DISTANCE_CM / timeTakenSec;

    handleSpeedResult(speedCmS);
  }
}

// =====================================================
// 속도 측정 타임아웃 처리
// =====================================================
void updateTimeout() {
  if (!isMeasuring) {
    return;
  }

  if (millis() - startMeasureTime > MEASURE_TIMEOUT_MS) {
    isMeasuring = false;

    setState(STATE_TIMEOUT);
    showTimeout();

    Serial.println("[SPEED] Measure timeout");
  }
}

// =====================================================
// 이벤트 상태 자동 복귀 처리
// =====================================================
void updateEventState() {
  unsigned long now = millis();

  if (
    currentState == STATE_SAFE ||
    currentState == STATE_OVER_SPEED ||
    currentState == STATE_CRITICAL_SPEED
  ) {
    if (now - stateStartTime >= RESULT_DISPLAY_MS) {
      overSpeedEvent = false;
      criticalSpeedEvent = false;

      // 속력 초기화 
      lastSpeedCmS = 0.0;             // 화면에 표시될 속도 0으로 초기화
      lastSpeedKmh = 0.0;
      speedStage = 0;                 // 속도 단계 0으로 초기화
      bumpServo.write(SERVO_STAGE_0); // 방지턱 모터도 완전히 평면(0도)으로 원위치

      setState(STATE_READY);
      showReady();
    }
    return;
  }

  if (currentState == STATE_IMPACT) {
    if (now - stateStartTime >= IMPACT_DISPLAY_MS) {
      impactEvent = false;
      setState(STATE_READY);
      showReady();
    }
    return;
  }

  if (currentState == STATE_EMERGENCY) {
    if (now - stateStartTime >= EMERGENCY_DISPLAY_MS) {
      nfcEvent = false;
      setState(STATE_READY);
      showReady();
    }
    return;
  }

  if (currentState == STATE_TIMEOUT) {
    if (now - stateStartTime >= TIMEOUT_DISPLAY_MS) {
      setState(STATE_READY);
      showReady();
    }
    return;
  }

  if (currentState == STATE_READY) {
    if (now - lastReadyLcdTime >= LCD_READY_INTERVAL_MS) {
      lastReadyLcdTime = now;
      showReady();
    }
  }
}

// =====================================================
// 속도 인식 4단계 제어
// =====================================================
void handleSpeedResult(float speedCmS) {
  isMeasuring = false;

  lastSpeedCmS = speedCmS;
  lastSpeedKmh = speedCmS * 0.036;

  overSpeedEvent = false;
  criticalSpeedEvent = false;

  Serial.println("===== SPEED RESULT =====");
  Serial.print("Speed: ");
  Serial.print(lastSpeedCmS, 1);
  Serial.print(" cm/s / ");
  Serial.print(lastSpeedKmh, 2);
  Serial.println(" km/h");

  if (speedCmS > SPEED_CRITICAL_CM_S) {
    speedStage = 3;
    overSpeedEvent = true;
    criticalSpeedEvent = true;

    setState(STATE_CRITICAL_SPEED);
    bumpServo.write(SERVO_STAGE_3);

    Serial.println("Stage: 3 - CRITICAL SPEED");
  }

  else if (speedCmS > SPEED_LIMIT_CM_S) {
    speedStage = 2;
    overSpeedEvent = true;

    setState(STATE_OVER_SPEED);
    bumpServo.write(SERVO_STAGE_2);

    Serial.println("Stage: 2 - OVER SPEED");
  }

  else if (speedCmS > SPEED_SAFE_MIN_CM_S) {
    speedStage = 1;

    setState(STATE_SAFE);
    bumpServo.write(SERVO_STAGE_1);

    Serial.println("Stage: 1 - SAFE SPEED");
  }

  else {
    speedStage = 0;

    setState(STATE_SAFE);
    bumpServo.write(SERVO_STAGE_0);

    Serial.println("Stage: 0 - VERY SLOW");
  }

  Serial.println("========================");

  showSpeedResult();
}

// =====================================================
// 충격 감지 처리
// =====================================================
void handleImpact() {
  isMeasuring = false;
  impactEvent = true;

  setState(STATE_IMPACT);
  showImpact();

  Serial.println("[IMPACT] DETECTED");
  Serial.print("[IMPACT] VIB Value: ");
  Serial.println(vibValue);
}

// =====================================================
// 외부 NFC 서브보드 긴급차량 처리
// =====================================================
void handleEmergencyVehicle() {
  isMeasuring = false;
  nfcEvent = true;

  // 긴급차량 감지 시 방지턱 낮춤
  speedStage = 0;
  bumpServo.write(SERVO_STAGE_0);

  setState(STATE_EMERGENCY);
  showEmergency();

  Serial.println("[EXT NFC] EMERGENCY VEHICLE DETECTED");
}

// =====================================================
// 상태 변경
// =====================================================
void setState(SystemState newState) {
  currentState = newState;
  stateStartTime = millis();
}

// =====================================================
// 상태 문자열 반환
// =====================================================
const char* getStateText() {
  switch (currentState) {
    case STATE_READY:
      return "READY";

    case STATE_MEASURING:
      return "MEASURING";

    case STATE_SAFE:
      return "SAFE";

    case STATE_OVER_SPEED:
      return "OVER";

    case STATE_CRITICAL_SPEED:
      return "CRITICAL";

    case STATE_IMPACT:
      return "IMPACT";

    case STATE_EMERGENCY:
      return "EMERGENCY";

    case STATE_TIMEOUT:
      return "TIMEOUT";

    default:
      return "UNKNOWN";
  }
}

// =====================================================
// LCD: 대기 화면
// =====================================================
void showReady() {
  lcdSpeed.clear();

  lcdSpeed.setCursor(0, 0);
  lcdSpeed.print("Speed:");
  lcdSpeed.print(lastSpeedCmS, 0);
  lcdSpeed.print("cm/s");

  lcdSpeed.setCursor(0, 1);
  lcdSpeed.print("State:");
  lcdSpeed.print(getStateText());
}

// =====================================================
// LCD: 측정 중
// =====================================================
void showMeasuring() {
  lcdSpeed.clear();

  lcdSpeed.setCursor(0, 0);
  lcdSpeed.print("Measuring...");

  lcdSpeed.setCursor(0, 1);
  lcdSpeed.print("Wait Sensor2");
}

// =====================================================
// LCD: 속도 결과
// =====================================================
void showSpeedResult() {
  lcdSpeed.clear();

  lcdSpeed.setCursor(0, 0);
  lcdSpeed.print(lastSpeedCmS, 1);
  lcdSpeed.print("cm/s");

  lcdSpeed.setCursor(0, 1);

  if (speedStage == 3) {
    lcdSpeed.print("CRITICAL S3");
  } else if (speedStage == 2) {
    lcdSpeed.print("OVER SPEED S2");
  } else if (speedStage == 1) {
    lcdSpeed.print("SAFE SPEED S1");
  } else {
    lcdSpeed.print("VERY SLOW S0");
  }
}

// =====================================================
// LCD: 충격 감지
// =====================================================
void showImpact() {
  lcdSpeed.clear();

  lcdSpeed.setCursor(0, 0);
  lcdSpeed.print("!! IMPACT !!");

  lcdSpeed.setCursor(0, 1);
  lcdSpeed.print("VIB:");
  lcdSpeed.print(vibValue);
}

// =====================================================
// LCD: 긴급차량 감지
// =====================================================
void showEmergency() {
  lcdSpeed.clear();

  lcdSpeed.setCursor(0, 0);
  lcdSpeed.print("EMERGENCY CAR");

  lcdSpeed.setCursor(0, 1);
  lcdSpeed.print("BUMP DOWN");
}

// =====================================================
// LCD: 타임아웃
// =====================================================
void showTimeout() {
  lcdSpeed.clear();

  lcdSpeed.setCursor(0, 0);
  lcdSpeed.print("Timeout");

  lcdSpeed.setCursor(0, 1);
  lcdSpeed.print("D1/D2 Check");
}

// =====================================================
// 시리얼 상태 출력
// =====================================================
void printStatus() {
  if (millis() - lastSerialTime < SERIAL_INTERVAL_MS) {
    return;
  }

  lastSerialTime = millis();

  Serial.println("------ STATUS ------");

  Serial.print("STATE: ");
  Serial.println(getStateText());

  Serial.print("STAGE: ");
  Serial.println(speedStage);

  Serial.print("D1: ");
  Serial.print(dist1, 1);
  Serial.print(" cm / D2: ");
  Serial.print(dist2, 1);
  Serial.println(" cm");

  Serial.print("SPEED: ");
  Serial.print(lastSpeedCmS, 1);
  Serial.print(" cm/s / ");
  Serial.print(lastSpeedKmh, 2);
  Serial.println(" km/h");

  Serial.print("VIB: ");
  Serial.println(vibValue);

  Serial.print("TEMP: ");
  Serial.print(temperature, 1);
  Serial.print(" C / HUMI: ");
  Serial.print(humidity, 1);
  Serial.println(" %");

  Serial.print("EXT NFC SIGNAL: ");
  Serial.println(extNfcSignalActive ? "ACTIVE" : "IDLE");

  Serial.print("NFC EVENT: ");
  Serial.println(nfcEvent ? "YES" : "NO");

  Serial.print("OVER EVENT: ");
  Serial.println(overSpeedEvent ? "YES" : "NO");

  Serial.print("CRITICAL EVENT: ");
  Serial.println(criticalSpeedEvent ? "YES" : "NO");

  Serial.println("--------------------");
}

// =====================================================
// D1 WiFi 보드 데이터 전송
// =====================================================
// CSV 포맷:
// 상태,단계,속도cm/s,속도km/h,과속여부,위험과속여부,충격여부,NFC이벤트,온도,습도,거리1,거리2,진동값,외부NFC입력상태
// =====================================================
void sendToD1() {
  if (millis() - lastD1Time < D1_INTERVAL_MS) {
    return;
  }
  lastD1Time = millis();

  // (기존 Serial1.print 코드들은 그대로 유지...)
  Serial1.print(getStateText()); Serial1.print(",");
  // ... 생략 ...
  Serial1.println(extNfcSignalActive ? 1 : 0);

  // ⭐ [여기에 추가] 노트북 Node.js가 똑바로 낚아챌 수 있도록 CSV 포맷을 Serial로도 한 줄 출력!
  // 포맷 순서: 상태,단계,속도cm/s,속도km/h,과속여부,위험과속여부,충격여부,NFC이벤트,온도,습도,거리1,거리2,진동값,외부NFC상태
  Serial.print(getStateText()); Serial.print(",");
  Serial.print(speedStage); Serial.print(",");
  Serial.print(lastSpeedCmS, 1); Serial.print(",");
  Serial.print(lastSpeedKmh, 2); Serial.print(",");
  Serial.print(overSpeedEvent ? 1 : 0); Serial.print(",");
  Serial.print(criticalSpeedEvent ? 1 : 0); Serial.print(",");
  Serial.print(impactEvent ? 1 : 0); Serial.print(",");
  Serial.print(nfcEvent ? 1 : 0); Serial.print(",");
  Serial.print(temperature, 1); Serial.print(",");
  Serial.print(humidity, 1); Serial.print(",");
  Serial.print(dist1, 1); Serial.print(",");
  Serial.print(dist2, 1); Serial.print(",");
  Serial.print(vibValue); Serial.print(",");
  Serial.println(extNfcSignalActive ? 1 : 0); // 맨 끝은 무조건 println(줄바꿈) 필수!
}