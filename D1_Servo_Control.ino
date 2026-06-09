#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <Servo.h>

// ===== WiFi 설정 =====
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// 서버 및 서보 설정
ESP8266WebServer server(80);
Servo myServo;
const int SERVO_PIN = D2;  // Wemos D1의 D2 핀

// 서보 캘리브레이션
const int SERVO_MIN_PULSE_US = 500;
const int SERVO_MAX_PULSE_US = 2500;
const bool SERVO_INVERT = false;      // true면 0/180이 반전됩니다.

const int SERVO_INITIAL_ANGLE = 90;   // 부팅 시 기본 수평 위치
const int SERVO_OPEN_ANGLE = 0;       // UP 명령 시 목표 각도
const int SERVO_CLOSE_ANGLE = 180;    // DOWN 명령 시 목표 각도

void handleRoot() {
  String html = "<!DOCTYPE HTML><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
  html += "<style>body{text-align:center;font-family:sans-serif;margin-top:40px;} .btn{display:inline-block;padding:14px 30px;margin:10px;font-size:18px;text-decoration:none;color:#fff;border-radius:8px;} .open{background:#2ecc71;} .close{background:#e74c3c;} .info{margin-top:30px;color:#555;}</style>";
  html += "<title>Wemos D1 Servo Control</title></head><body>";
  html += "<h1>Wemos D1 서보 제어</h1>";
  html += "<a class=\"btn open\" href=\"/OPEN\">OPEN</a>";
  html += "<a class=\"btn close\" href=\"/CLOSE\">CLOSE</a>";
  html += "<div class=\"info\">/OPEN, /CLOSE, /servo?angle=0~180</div>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleOpen() {
  const int angle = getServoAngle(SERVO_OPEN_ANGLE);
  myServo.write(angle);
  Serial.printf("Servo Status: OPEN (%d deg)\n", SERVO_OPEN_ANGLE);
  server.send(200, "text/plain", "OK: OPEN");
}

void handleClose() {
  const int angle = getServoAngle(SERVO_CLOSE_ANGLE);
  myServo.write(angle);
  Serial.printf("Servo Status: CLOSE (%d deg)\n", SERVO_CLOSE_ANGLE);
  server.send(200, "text/plain", "OK: CLOSE");
}

void handleServoAngle() {
  if (!server.hasArg("angle")) {
    server.send(400, "text/plain", "Missing angle parameter");
    return;
  }

  int angle = server.arg("angle").toInt();
  angle = constrain(angle, 0, 180);
  const int servoAngle = getServoAngle(angle);
  myServo.write(servoAngle);
  Serial.printf("Servo Status: ANGLE %d (mapped %d)\n", angle, servoAngle);
  server.send(200, "text/plain", "OK: ANGLE=" + String(angle));
}

void handleNotFound() {
  String message = "404 Not Found\n";
  message += "URI: ";
  message += server.uri();
  message += "\n";
  server.send(404, "text/plain", message);
}

int getServoAngle(int angle) {
  angle = constrain(angle, 0, 180);
  if (SERVO_INVERT) {
    angle = 180 - angle;
  }
  return angle;
}

void setServoToAngle(int angle) {
  const int servoAngle = getServoAngle(angle);
  myServo.write(servoAngle);
  Serial.printf("Servo Status: ANGLE %d (mapped %d)\n", angle, servoAngle);
}

void processSerialCommand(const String &cmd) {
  String data = cmd;
  data.trim();
  data.toUpperCase();

  if (data == "OPEN") {
    setServoToAngle(SERVO_OPEN_ANGLE);
    Serial.println("USB CMD: OPEN");
  } else if (data == "CLOSE") {
    setServoToAngle(SERVO_CLOSE_ANGLE);
    Serial.println("USB CMD: CLOSE");
  } else if (data.startsWith("ANGLE=")) {
    int angle = data.substring(6).toInt();
    setServoToAngle(angle);
    Serial.printf("USB CMD: ANGLE=%d\n", angle);
  } else if (data.startsWith("SERVO=")) {
    int angle = data.substring(6).toInt();
    setServoToAngle(angle);
    Serial.printf("USB CMD: SERVO=%d\n", angle);
  } else {
    Serial.printf("USB CMD: unknown '%s'\n", data.c_str());
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  myServo.attach(SERVO_PIN, SERVO_MIN_PULSE_US, SERVO_MAX_PULSE_US);
  myServo.write(getServoAngle(SERVO_INITIAL_ANGLE));
  delay(500);
  Serial.printf("Servo attached and set to %d degrees\n", SERVO_INITIAL_ANGLE);

  server.on("/", handleRoot);
  server.on("/OPEN", handleOpen);
  server.on("/CLOSE", handleClose);
  server.on("/servo", HTTP_GET, handleServoAngle);
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    if (cmd.length() > 0) {
      processSerialCommand(cmd);
    }
  }

  server.handleClient();
}
