#include <Arduino.h>
#include <WiFi.h>

#include "TFTScreen/DisplayManager.h"
#include "WifiManager/ConfigStore.h"
#include "WifiManager/NetworkManager.h"
#include "WifiManager/PortalServer.h"

namespace {
constexpr uint8_t kBootButtonPin = 0;
constexpr uint32_t kBootHoldToResetMs = 5000;
constexpr uint32_t kBootDebounceMs = 45;
constexpr uint32_t kBootShortPressMinMs = 40;
constexpr uint32_t kWifiConnectTimeoutMs = 10000;
constexpr uint32_t kRegisterIntervalMs = 60000;
constexpr uint32_t kFingerprintDemoIntervalMs = 45000;
constexpr const char *kApiKey = "THIS_IS_A_STRONG_DEVICE_API_KEY_REPLACE_BEFORE_PRODUCTION";

enum class RegistrationState : uint8_t {
  PENDING,
  FAILED,
  SUCCESS,
};

DisplayManager display;
ConfigStore configStore;
NetworkManager network;
PortalServer portalServer;

DeviceConfig currentConfig;

bool isPortalMode = false;
bool shouldRestartAfterSave = false;
uint32_t restartScheduledAtMs = 0;
RegistrationState registrationState = RegistrationState::PENDING;
NetworkManager::RemoteDeviceStatus remoteDeviceStatus =
  NetworkManager::RemoteDeviceStatus::UNKNOWN;

unsigned long lastRegisterAttemptMs = 0;
unsigned long lastFingerprintCallbackMs = 0;
uint32_t fakeFingerprintCounter = 1000;

bool bootRawPressed = false;
bool bootStablePressed = false;
bool bootLongPressHandled = false;
bool bootShortPressEvent = false;
uint32_t bootPressedAtMs = 0;
uint32_t bootLastBounceMs = 0;

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

void updateBootButtonEvents() {
  const bool rawPressed = digitalRead(kBootButtonPin) == LOW;

  if (rawPressed != bootRawPressed) {
    bootRawPressed = rawPressed;
    bootLastBounceMs = millis();
  }

  if (millis() - bootLastBounceMs < kBootDebounceMs) {
    return;
  }

  if (bootStablePressed != bootRawPressed) {
    bootStablePressed = bootRawPressed;

    if (bootStablePressed) {
      bootPressedAtMs = millis();
      bootLongPressHandled = false;
    } else {
      const uint32_t heldMs = millis() - bootPressedAtMs;
      if (!bootLongPressHandled && heldMs >= kBootShortPressMinMs &&
          heldMs < kBootHoldToResetMs) {
        bootShortPressEvent = true;
      }
    }
  }

  if (bootStablePressed && !bootLongPressHandled &&
      millis() - bootPressedAtMs >= kBootHoldToResetMs) {
    bootLongPressHandled = true;
    clearSettingsAndReboot();
  }
}

bool consumeBootShortPressEvent() {
  if (!bootShortPressEvent) {
    return false;
  }

  bootShortPressEvent = false;
  return true;
}

void performRemoteWipeAndReboot() {
  Serial.println("[RemoteWipe] Device denied by server (403/404). Resetting local config...");
  display.showDeviceDeletedFactoryResetting();
  configStore.clearAll();
  delay(2000);
  ESP.restart();
}

void showRemoteModeIfChanged(NetworkManager::RemoteDeviceStatus nextStatus) {
  if (remoteDeviceStatus == nextStatus) {
    return;
  }

  remoteDeviceStatus = nextStatus;

  if (nextStatus == NetworkManager::RemoteDeviceStatus::ACTIVE) {
    display.showConnectedSuccessfully();
    delay(1000);
    display.showWelcome();
    return;
  }

  if (nextStatus == NetworkManager::RemoteDeviceStatus::INACTIVE) {
    display.showInactiveMode();
    return;
  }

  if (nextStatus == NetworkManager::RemoteDeviceStatus::MAINTENANCE) {
    display.showMaintenanceMode();
    return;
  }
}

bool runAutoRegistration() {
  const NetworkManager::RegisterHeartbeatResult registerResult =
      network.autoRegisterDevice(currentConfig, String(kApiKey));
  const int lastStatusCode = registerResult.httpStatusCode;
  Serial.printf("[Register] Register result: %s\n",
                registerResult.ok ? "SUCCESS" : "FAILED");
  Serial.printf("[Register] Last HTTP status: %d\n", lastStatusCode);

  if (lastStatusCode == 403 || lastStatusCode == 404) {
    performRemoteWipeAndReboot();
    return false;
  }

  if (!registerResult.ok) {
    registrationState = RegistrationState::FAILED;
    remoteDeviceStatus = NetworkManager::RemoteDeviceStatus::UNKNOWN;
    display.showServerConnectionFailed(lastStatusCode);
    return false;
  }

  registrationState = RegistrationState::SUCCESS;
  showRemoteModeIfChanged(registerResult.remoteStatus);
  return true;
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

  runAutoRegistration();

  lastRegisterAttemptMs = millis();
  lastFingerprintCallbackMs = millis();
}

void loop() {
  updateBootButtonEvents();

  if (isPortalMode) {
    portalServer.handleClient();

    if (shouldRestartAfterSave && millis() - restartScheduledAtMs >= 800) {
      ESP.restart();
    }

    delay(20);
    return;
  }

  if (registrationState == RegistrationState::FAILED &&
      consumeBootShortPressEvent()) {
    Serial.println("[Register] BOOT short press detected. Retrying registration...");
    runAutoRegistration();
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected. Trying to reconnect...");
    if (!network.connectStation(currentConfig, kWifiConnectTimeoutMs)) {
      Serial.println("[WiFi] Reconnect failed. Switching to portal mode.");
      enterPortalMode();
      return;
    }

    if (registrationState != RegistrationState::SUCCESS) {
      runAutoRegistration();
    }
  }

  const unsigned long now = millis();

  if (registrationState == RegistrationState::SUCCESS &&
      now - lastRegisterAttemptMs >= kRegisterIntervalMs) {
    const bool reRegisterOk = runAutoRegistration();
    if (!reRegisterOk) {
      return;
    }
    lastRegisterAttemptMs = now;
  }

  if (registrationState == RegistrationState::SUCCESS &&
      remoteDeviceStatus == NetworkManager::RemoteDeviceStatus::ACTIVE &&
      now - lastFingerprintCallbackMs >= kFingerprintDemoIntervalMs) {
    const String fakeFingerprintId = String("F-") + String(fakeFingerprintCounter++);
    network.sendFingerprintCallback(currentConfig, String(kApiKey),
                                    fakeFingerprintId);
    lastFingerprintCallbackMs = now;
  }

  delay(100);
}