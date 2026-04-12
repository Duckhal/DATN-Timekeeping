#include <Arduino.h>
#include <WiFi.h>

#include "TFTScreen/DisplayManager.h"
#include "WifiManager/ConfigStore.h"
#include "WifiManager/NetworkManager.h"
#include "WifiManager/PortalServer.h"

namespace {
constexpr uint8_t kBootButtonPin = 0;
constexpr uint32_t kBootHoldToResetMs = 5000;
constexpr uint32_t kWifiConnectTimeoutMs = 10000;
constexpr uint32_t kRegisterIntervalMs = 60000;
constexpr uint32_t kFingerprintDemoIntervalMs = 45000;
constexpr const char *kApiKey = "REPLACE_WITH_DEVICE_API_KEY";

DisplayManager display;
ConfigStore configStore;
NetworkManager network;
PortalServer portalServer;

DeviceConfig currentConfig;

bool isPortalMode = false;
bool shouldRestartAfterSave = false;
uint32_t restartScheduledAtMs = 0;

unsigned long lastRegisterAttemptMs = 0;
unsigned long lastFingerprintCallbackMs = 0;
uint32_t fakeFingerprintCounter = 1000;

bool isBootPressTracking = false;
uint32_t bootPressedAtMs = 0;

String buildPortalSsidFromMac(const String &macAddress) {
  String compactMac = macAddress;
  compactMac.replace(":", "");
  return String("ESP32-Timekeeping-") + compactMac;
}

void scheduleRestart() {
  shouldRestartAfterSave = true;
  restartScheduledAtMs = millis();
}

void enterPortalMode() {
  const String apSsid = buildPortalSsidFromMac(network.getMacAddress());
  network.startConfigAp(apSsid);

  display.showNotConnected(apSsid, "192.168.4.1");

  portalServer.begin([](const DeviceConfig &config) {
    const bool saved = configStore.save(config);
    if (!saved) {
      Serial.println("[Config] Failed to save configuration.");
      return;
    }

    Serial.println("[Config] Configuration saved. Restart is scheduled.");
    scheduleRestart();
  });

  isPortalMode = true;
  Serial.printf("[AP] Portal started. SSID=%s IP=%s\n", apSsid.c_str(),
                network.apIpAddress().c_str());
}

void clearSettingsAndReboot() {
  Serial.println("[Reset] BOOT button held for 5s. Clearing settings...");
  configStore.clearAll();
  display.showSettingsCleared();
  delay(1200);
  ESP.restart();
}

void processBootButtonReset() {
  const bool isPressed = digitalRead(kBootButtonPin) == LOW;

  if (isPressed && !isBootPressTracking) {
    isBootPressTracking = true;
    bootPressedAtMs = millis();
    return;
  }

  if (!isPressed) {
    isBootPressTracking = false;
    return;
  }

  if (isBootPressTracking && (millis() - bootPressedAtMs >= kBootHoldToResetMs)) {
    clearSettingsAndReboot();
  }
}

bool tryConnectUsingSavedConfig() {
  currentConfig = configStore.load();
  if (!currentConfig.isValid()) {
    Serial.println("[Config] No valid saved configuration found.");
    return false;
  }

  Serial.printf("[WiFi] Connecting to SSID=%s\n", currentConfig.ssid.c_str());
  const bool connected =
      network.connectStation(currentConfig, kWifiConnectTimeoutMs);

  if (!connected) {
    Serial.println("[WiFi] Failed to connect within timeout.");
    return false;
  }

  Serial.println("[WiFi] Connected successfully.");
  Serial.printf("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("[WiFi] MAC Address: %s\n", network.getMacAddress().c_str());
  return true;
}
}  // namespace

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(kBootButtonPin, INPUT_PULLUP);

  display.begin();

  if (!configStore.begin()) {
    Serial.println("[Config] Preferences init failed. Entering portal mode.");
    enterPortalMode();
    return;
  }

  if (!tryConnectUsingSavedConfig()) {
    enterPortalMode();
    return;
  }

  display.showWelcome();

  const bool registered =
      network.autoRegisterDevice(currentConfig, String(kApiKey));
  Serial.printf("[Register] Initial register result: %s\n",
                registered ? "SUCCESS" : "FAILED");

  lastRegisterAttemptMs = millis();
  lastFingerprintCallbackMs = millis();
}

void loop() {
  processBootButtonReset();

  if (isPortalMode) {
    portalServer.handleClient();

    if (shouldRestartAfterSave && millis() - restartScheduledAtMs >= 800) {
      ESP.restart();
    }

    delay(20);
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected. Trying to reconnect...");
    if (!network.connectStation(currentConfig, kWifiConnectTimeoutMs)) {
      Serial.println("[WiFi] Reconnect failed. Switching to portal mode.");
      enterPortalMode();
      return;
    }
  }

  const unsigned long now = millis();

  if (now - lastRegisterAttemptMs >= kRegisterIntervalMs) {
    network.autoRegisterDevice(currentConfig, String(kApiKey));
    lastRegisterAttemptMs = now;
  }

  if (now - lastFingerprintCallbackMs >= kFingerprintDemoIntervalMs) {
    const String fakeFingerprintId = String("F-") + String(fakeFingerprintCounter++);
    network.sendFingerprintCallback(currentConfig, String(kApiKey),
                                    fakeFingerprintId);
    lastFingerprintCallbackMs = now;
  }

  delay(100);
}