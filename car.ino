/*
  스마트 방지턱 프로젝트 - 버튼 조작형 시연용 자동차 코드 (최종 완결판)

  [기능]
  1. 부드러운 가속/감속 (Soft Start & Stop)
  2. 상태 표시 LED (Red: 정지, Yellow: 주행)
  3. 직진 주행 보정 (Motor Offset) - 양쪽 모터 속도 불균형 해결
*/

// ==================== 🛠️ 수정할 부분: 직진 보정 설정 ====================
// 차가 한쪽으로 휜다면 아래 숫자(1.0)를 0.95, 0.9, 0.85 식으로 조금씩 줄여보세요.
// 최대 1.0 (100% 출력) ~ 최소 0.0 (0% 출력)

float leftOffset  = 1.0;  // 왼쪽 바퀴가 너무 빠르면(오른쪽으로 휨) 이 숫자를 줄이세요.
float rightOffset = 0.85;  // 오른쪽 바퀴가 너무 빠르면(왼쪽으로 휨) 이 숫자를 줄이세요.
// ========================================================================

// ==================== L298N 핀 설정 ====================
const int ENA = 5;
const int IN1 = 7;
const int IN2 = 8;

const int ENB = 6;
const int IN3 = 12;
const int IN4 = 13;

// ==================== 버튼 & LED 핀 설정 ====================
const int BTN_SLOW   = 2;   // 초록색 버튼 (저속)
const int BTN_NORMAL = 3;   // 하얀색 버튼 (중속)
const int BTN_FAST   = 4;   // 노란색 버튼 (고속)
const int BTN_STOP   = 9;   // 빨간색 버튼 (정지)

const int LED_STOP_RED     = 10;  // 정지 상태 표시 (빨간색 LED)
const int LED_DRIVE_YELLOW = 11;  // 주행 상태 표시 (노란색 LED)

// ==================== 속도 설정 ====================
const int SPEED_SLOW   = 120;
const int SPEED_NORMAL = 150;
const int SPEED_FAST   = 220;

const unsigned long DEBOUNCE_DELAY = 50;

// ==================== 가감속 제어 변수 ====================
int currentSpeed = 0;   
int targetSpeed = 0;    

unsigned long lastSpeedChangeTime = 0;
const int SPEED_STEP = 5;              
const int SPEED_INTERVAL = 10;         

bool lastBtnState[14] = {
  HIGH, HIGH, HIGH, HIGH, HIGH, HIGH, HIGH, 
  HIGH, HIGH, HIGH, HIGH, HIGH, HIGH, HIGH
};

void setup() {
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  pinMode(LED_STOP_RED, OUTPUT);
  pinMode(LED_DRIVE_YELLOW, OUTPUT);

  pinMode(BTN_SLOW, INPUT_PULLUP);
  pinMode(BTN_NORMAL, INPUT_PULLUP);
  pinMode(BTN_FAST, INPUT_PULLUP);
  pinMode(BTN_STOP, INPUT_PULLUP);

  targetSpeed = 0;
  stopCar();
  
  digitalWrite(LED_STOP_RED, HIGH);
  digitalWrite(LED_DRIVE_YELLOW, LOW);
}

void loop() {
  // 1. 버튼 입력 감지 및 LED 제어
  if (isButtonPressed(BTN_STOP)) {
    targetSpeed = 0;
    digitalWrite(LED_STOP_RED, HIGH);
    digitalWrite(LED_DRIVE_YELLOW, LOW);
  }

  if (isButtonPressed(BTN_SLOW)) {
    targetSpeed = SPEED_SLOW;
    digitalWrite(LED_STOP_RED, LOW);     
    digitalWrite(LED_DRIVE_YELLOW, HIGH); 
    setForwardDirection();
  }

  if (isButtonPressed(BTN_NORMAL)) {
    targetSpeed = SPEED_NORMAL;
    digitalWrite(LED_STOP_RED, LOW);
    digitalWrite(LED_DRIVE_YELLOW, HIGH);
    setForwardDirection();
  }

  if (isButtonPressed(BTN_FAST)) {
    targetSpeed = SPEED_FAST;
    digitalWrite(LED_STOP_RED, LOW);
    digitalWrite(LED_DRIVE_YELLOW, HIGH);
    setForwardDirection();
  }

  // 2. 부드러운 가속 및 감속 처리
  if (millis() - lastSpeedChangeTime >= SPEED_INTERVAL) {
    if (currentSpeed < targetSpeed) {
      currentSpeed += SPEED_STEP;
      if (currentSpeed > targetSpeed) currentSpeed = targetSpeed;
      applySpeed(currentSpeed);
      
    } else if (currentSpeed > targetSpeed) {
      currentSpeed -= SPEED_STEP;
      if (currentSpeed < targetSpeed) currentSpeed = targetSpeed;
      applySpeed(currentSpeed);
      
    } else if (currentSpeed == 0 && targetSpeed == 0) {
      stopCar();
    }
    
    lastSpeedChangeTime = millis();
  }
}

// ==================== 버튼 감지 함수 ====================
bool isButtonPressed(int buttonPin) {
  bool currentState = digitalRead(buttonPin);
  bool isTriggered = false;

  if (lastBtnState[buttonPin] == HIGH && currentState == LOW) {
    delay(DEBOUNCE_DELAY);
    if (digitalRead(buttonPin) == LOW) {
      isTriggered = true;
    }
  }
  lastBtnState[buttonPin] = currentState;
  return isTriggered;
}

// ==================== 모터 방향 설정 ====================
void setForwardDirection() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
}

// ==================== 🛠️ 직진 보정이 적용된 속도 함수 ====================
void applySpeed(int speedValue) {
  // 위에서 설정한 보정값(Offset)을 곱해서 최종 속도를 계산합니다.
  int leftSpeed  = speedValue * leftOffset;
  int rightSpeed = speedValue * rightOffset;

  analogWrite(ENA, leftSpeed);
  analogWrite(ENB, rightSpeed);
}

// ==================== 모터 제동 ====================
void stopCar() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);
}