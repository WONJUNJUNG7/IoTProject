#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>
#include <LiquidCrystal_I2C.h>

// =====================================================
// 서브 보드 코드
// 역할:
// 1. PN532 NFC 센서 감지
// 2. NFC 감지 시 메인보드로 HIGH 신호 전송
// 3. 서브보드에 연결된 LCD에 상태 출력
//
// Arduino Mega I2C:
// SDA = 20
// SCL = 21
// =====================================================

// =====================================================
// 핀 설정
// =====================================================
const int nfcSignalPin = 7; // 메인보드로 신호를 보낼 핀
const int BUZZER_PIN = 8;   // 피에조 부저 핀
const int LED_PIN = 9;      // 경고용 LED 핀

// =====================================================
// 객체 생성
// =====================================================
PN532_I2C pn532i2c(Wire);
PN532 nfc(pn532i2c);
LiquidCrystal_I2C lcd(0x27, 16, 2);

// =====================================================
// 시스템 상태 및 타이머 변수
// =====================================================
bool isEmergency = false;
unsigned long emergencyStartTime = 0;
const unsigned long SIGNAL_TIME_MS = 5000; // 5초 동안 알림 및 신호 유지

// 부저/LED 깜빡임 제어용 변수
unsigned long lastBeepTime = 0;
bool beepState = false;
const unsigned long BEEP_INTERVAL = 300; // 300ms 간격으로 깜빡임
const int BEEP_FREQ = 1000; // 부저 주파수

unsigned long lastScanPrintTime = 0;
const unsigned long SCAN_PRINT_INTERVAL = 1000;

// =====================================================
// LCD 메시지 출력 함수
// =====================================================
void showLCD(String line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, 16));
}

void setup() {
  Serial.begin(9600);
  delay(1000);

  Serial.println();
  Serial.println("================================");
  Serial.println("PN532 NFC I2C TEST - Arduino Mega");
  Serial.println("SDA = 20, SCL = 21");
  Serial.println("NFC 인식 시 메인보드로 신호 전송");
  Serial.println("LCD에 NFC 상태 출력");
  Serial.println("================================");

// =====================================================
// 출력 핀 초기화
// =====================================================
  pinMode(nfcSignalPin, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  
  digitalWrite(nfcSignalPin, LOW);
  digitalWrite(LED_PIN, LOW);
  noTone(BUZZER_PIN);

  Wire.begin();
  Wire.setClock(100000);

  // LCD 초기화
  lcd.init();
  lcd.backlight();
  showLCD("NFC SYSTEM", "BOOTING...");
  delay(1000);

  // NFC 초기화
  nfc.begin();
  Serial.println("PN532 펌웨어 확인 중...");
  showLCD("PN532 CHECK", "WAIT...");

  uint32_t versiondata = nfc.getFirmwareVersion();

  if (!versiondata) {
    Serial.println("PN532 보드를 찾을 수 없습니다.");
    Serial.println("확인할 것:");
    Serial.println("1. VCC / GND");
    Serial.println("2. SDA = Mega 20번");
    Serial.println("3. SCL = Mega 21번");
    Serial.println("4. PN532 모드가 I2C인지");
    Serial.println("5. 납땜 또는 점퍼선 접촉 불량");

    showLCD("PN532 ERROR", "CHECK WIRING");

    // 에러 시 무한 대기
    while (1) {
      delay(500); 
    }
  }

  nfc.SAMConfig();
  showLCD("NFC READY", "WAIT CARD");
  Serial.println("시스템 준비 완료. NFC 태그 대기 중...");
}

void loop() {
  unsigned long now = millis();

  // 1. 응급 상황(NFC 감지) 상태일 때
  if (isEmergency) {
    
    // (1) 부저와 LED를 BEEP_INTERVAL(300ms)마다 깜빡거리게 함
    if (now - lastBeepTime >= BEEP_INTERVAL) {
      lastBeepTime = now;
      beepState = !beepState;
      
      if (beepState) {
        tone(BUZZER_PIN, BEEP_FREQ);
        digitalWrite(LED_PIN, HIGH);
      } else {
        noTone(BUZZER_PIN);
        digitalWrite(LED_PIN, LOW);
      }
    }

    // (2) 5초(SIGNAL_TIME_MS)가 지나면 응급 상황 해제
    if (now - emergencyStartTime >= SIGNAL_TIME_MS) {
      isEmergency = false; 
      
      // 알림 장치들 확실하게 끄기
      noTone(BUZZER_PIN);
      digitalWrite(LED_PIN, LOW);
      beepState = false;

      // 메인보드로 보내던 HIGH 신호 끄기
      digitalWrite(nfcSignalPin, LOW);
      
      // 상황 종료 후 LCD를 다시 대기 상태로 복구
      showLCD("NFC READY", "WAIT CARD");
      Serial.println("상황 종료. 다시 대기합니다.");
    }
  }

  // =====================================================
  // NFC 카드 감지
  // =====================================================
  if (!isEmergency) {
    uint8_t success;
    uint8_t uid[7] = {0};
    uint8_t uidLength = 0;

    // 1초마다 시리얼 모니터에 스캔 중임을 표시
    if (now - lastScanPrintTime >= SCAN_PRINT_INTERVAL) {
      Serial.println("Scanning...");
      lastScanPrintTime = now;
    }

    // NFC 태그 읽기 시도
    success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength);

    // 만약 카드가 인식되었다면?
    if (success) {
      Serial.println("NFC 태그 인식 성공!");
      
      // 1. 상태를 '응급 상황'으로 변경하고 현재 시간을 기록
      isEmergency = true;
      emergencyStartTime = millis();

      // 2. 메인보드로 신호 전송 시작
      digitalWrite(nfcSignalPin, HIGH);

      // 3. LCD에 응급상황 텍스트 출력
      showLCD("EMERGENCY", "NFC DETECTED");
      
      // // (선택) 1번 코드에 있던 카드 고유번호(UID) 시리얼 출력 기능 복구
      // Serial.print("UID Value:");
      // for (uint8_t i = 0; i < uidLength; i++) {
      //   Serial.print(" 0x");
      //   if (uid[i] < 0x10) Serial.print("0");
      //   Serial.print(uid[i], HEX);
      // }
      Serial.println();
    }
  }
}