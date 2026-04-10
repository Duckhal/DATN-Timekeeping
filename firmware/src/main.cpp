#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFi.h>

// ===== Device runtime configuration =====
static const char *WIFI_SSID = "YOUR_WIFI_SSID";
static const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
static const char *SERVER_URL = "http://192.168.1.100:3000/api";
static const char *API_KEY = "REPLACE_WITH_DEVICE_API_KEY";

static unsigned long lastRegisterAttemptMs = 0;
static unsigned long lastFingerprintCallbackMs = 0;
static uint32_t fakeFingerprintCounter = 1000;

String getMacAddress() {
  return WiFi.macAddress();
}

String getAuthorizationHeader() {
  return String("Bearer ") + API_KEY;
}

bool postJson(const String &endpoint, const String &payload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Skip request because WiFi is disconnected.");
    return false;
  }

  HTTPClient http;
  const String url = String(SERVER_URL) + endpoint;

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", getAuthorizationHeader());

  const int statusCode = http.POST(payload);
  const String responseBody = http.getString();

  Serial.printf("[HTTP] POST %s -> %d\n", url.c_str(), statusCode);
  Serial.printf("[HTTP] Response: %s\n", responseBody.c_str());

  http.end();

  return statusCode >= 200 && statusCode < 300;
}

bool autoRegisterDevice() {
  const String mac = getMacAddress();
  const String name = String("ESP32-") + mac.substring(mac.length() - 5);
  const String payload =
      String("{\"mac_addr\":\"") + mac +
      "\",\"name\":\"" + name + "\"}";

  Serial.println("[Register] Sending device registration payload...");
  return postJson("/hardware/devices/register", payload);
}

bool sendFingerprintCallback(const String &fingerprintId) {
  const String mac = getMacAddress();
  const String payload =
      String("{\"mac_addr\":\"") + mac +
      "\",\"fingerprint_id\":\"" + fingerprintId + "\"}";

  Serial.printf("[Fingerprint] Sending callback for fingerprint_id=%s\n",
                fingerprintId.c_str());
  return postJson("/hardware/fingerprint/callback", payload);
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("[WiFi] Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("[WiFi] Connected successfully.");
  Serial.printf("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("[WiFi] MAC Address: %s\n", getMacAddress().c_str());
}

void setup() {
  Serial.begin(115200);
  delay(300);

  connectWifi();

  const bool registered = autoRegisterDevice();
  Serial.printf("[Register] Initial register result: %s\n",
                registered ? "SUCCESS" : "FAILED");

  lastRegisterAttemptMs = millis();
  lastFingerprintCallbackMs = millis();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected. Attempting reconnect...");
    connectWifi();
  }

  const unsigned long now = millis();

  // Re-register periodically so backend always keeps the device active.
  if (now - lastRegisterAttemptMs >= 60000UL) {
    autoRegisterDevice();
    lastRegisterAttemptMs = now;
  }

  // Demo callback: simulate a successful fingerprint scan every 45 seconds.
  if (now - lastFingerprintCallbackMs >= 45000UL) {
    const String fakeFingerprintId = String("F-") + String(fakeFingerprintCounter++);
    sendFingerprintCallback(fakeFingerprintId);
    lastFingerprintCallbackMs = now;
  }

  delay(100);
}