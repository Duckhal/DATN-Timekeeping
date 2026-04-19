#include <Arduino.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <PubSubClient.h>
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
constexpr uint32_t kMqttReconnectIntervalMs = 3000;
constexpr uint16_t kMqttPort = 1883;
constexpr uint32_t kEnrollTimeoutMs = 30000;
constexpr uint32_t kFingerprintRetryIntervalMs = 5000;
constexpr uint8_t kFingerprintMaxTemplateId = 127;
constexpr uint8_t kFpRx = 16;
constexpr uint8_t kFpTx = 17;
constexpr const char *kApiKey = "THIS_IS_A_STRONG_DEVICE_API_KEY_REPLACE_BEFORE_PRODUCTION";

enum class RegistrationState : uint8_t {
  PENDING,
  FAILED,
  SUCCESS,
};

enum class DeviceRuntimeState : uint8_t {
  NORMAL,
  ENROLLING,
};

enum class EnrollState : uint8_t {
  IDLE,
  FIND_EMPTY_SLOT,
  WAIT_FINGER_1,
  WAIT_REMOVE,
  WAIT_FINGER_2,
  SUCCESS,
  FAILED,
};

DisplayManager display;
ConfigStore configStore;
NetworkManager network;
PortalServer portalServer;
WiFiClient mqttTransport;
PubSubClient mqttClient(mqttTransport);
HardwareSerial fingerSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fingerSerial);

DeviceConfig currentConfig;

bool isPortalMode = false;
bool shouldRestartAfterSave = false;
uint32_t restartScheduledAtMs = 0;
RegistrationState registrationState = RegistrationState::PENDING;
NetworkManager::RemoteDeviceStatus remoteDeviceStatus =
    NetworkManager::RemoteDeviceStatus::UNKNOWN;
DeviceRuntimeState runtimeState = DeviceRuntimeState::NORMAL;
bool fingerprintSensorReady = false;
uint32_t lastFingerprintInitAttemptMs = 0;
String mqttCommandTopic;
uint32_t lastMqttReconnectAttemptMs = 0;
EnrollState enrollState = EnrollState::IDLE;
uint32_t enrollStartedAtMs = 0;
uint32_t enrollResultShownAtMs = 0;
uint8_t enrollTargetId = 0;

unsigned long lastRegisterAttemptMs = 0;

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

String buildMqttTopicFromMac(const String &macAddress) {
  return String("timekeeping/device/") + macAddress + "/command";
}

String buildMqttClientIdFromMac(const String &macAddress) {
  String clientId = String("timekeeping-") + macAddress;
  clientId.replace(":", "");
  return clientId;
}

bool tryInitFingerprintSensor(bool forceLog) {
  const uint32_t now = millis();
  if (!forceLog && now - lastFingerprintInitAttemptMs < kFingerprintRetryIntervalMs) {
    return fingerprintSensorReady;
  }

  lastFingerprintInitAttemptMs = now;

  fingerSerial.begin(57600, SERIAL_8N1, kFpRx, kFpTx);
  finger.begin(57600);

  const bool verified = finger.verifyPassword();
  if (forceLog || verified != fingerprintSensorReady) {
    Serial.printf("[Fingerprint] Sensor verify=%s (RX=%u TX=%u baud=%u)\n",
                  verified ? "OK" : "FAILED", kFpRx, kFpTx, 57600);
  }

  fingerprintSensorReady = verified;
  return fingerprintSensorReady;
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

void resetEnrollFlow() {
  runtimeState = DeviceRuntimeState::NORMAL;
  enrollState = EnrollState::IDLE;
  enrollTargetId = 0;
}

void clearSettingsAndReboot() {
  Serial.println("[Reset] BOOT button held for 5s. Clearing settings...");

  display.showNotifyingServer();

  if (currentConfig.isValid()) {
    const bool notifyOk =
        network.notifyFactoryReset(currentConfig, String(kApiKey), 3000);
    Serial.printf("[FactoryReset] Notify result: %s\n",
                  notifyOk ? "SUCCESS" : "FAILED");
  } else {
    Serial.println("[FactoryReset] Skip notify because runtime config is invalid.");
  }

  configStore.clearAll();
  display.showSettingsCleared();
  delay(1200);
  ESP.restart();
}

void failEnrollment() {
  runtimeState = DeviceRuntimeState::ENROLLING;
  enrollState = EnrollState::FAILED;
  display.showEnrollFailed();
  enrollResultShownAtMs = millis();
}

void showHomeScreenByRemoteStatus() {
  if (remoteDeviceStatus == NetworkManager::RemoteDeviceStatus::ACTIVE) {
    display.showWelcome();
  } else if (remoteDeviceStatus == NetworkManager::RemoteDeviceStatus::INACTIVE) {
    display.showInactiveMode();
  } else if (remoteDeviceStatus == NetworkManager::RemoteDeviceStatus::MAINTENANCE) {
    display.showMaintenanceMode();
  }
}

void succeedEnrollment() {
  const bool callbackOk = network.sendFingerprintCallback(
      currentConfig,
      String(kApiKey),
      String(enrollTargetId));

  const int callbackStatus = network.getLastHttpStatusCode();
  Serial.printf("[Enroll] Callback result: %s (http=%d)\n",
                callbackOk ? "SUCCESS" : "FAILED", callbackStatus);

  if (!callbackOk) {
    // Do not mark local enroll success if backend did not receive callback.
    failEnrollment();
    return;
  }

  enrollState = EnrollState::SUCCESS;
  display.showEnrollSuccess(enrollTargetId);
  enrollResultShownAtMs = millis();
}

void onMqttMessage(char *topic, byte *payload, unsigned int length) {
  if (!topic || !payload || length == 0) {
    return;
  }

  StaticJsonDocument<128> doc;
  const DeserializationError err = deserializeJson(doc, payload, length);

  if (err) {
    Serial.printf("[MQTT] Invalid JSON command: %s\n", err.c_str());
    return;
  }

  const String command = doc["command"] | "";
  Serial.printf("[MQTT] Topic=%s Command=%s\n", topic, command.c_str());

  if (command != "ENROLL_FINGERPRINT") {
    return;
  }

  if (!tryInitFingerprintSensor(true)) {
    Serial.println("[Enroll] Fingerprint sensor is not ready.");
    failEnrollment();
    return;
  }

  if (remoteDeviceStatus != NetworkManager::RemoteDeviceStatus::ACTIVE) {
    Serial.println("[Enroll] Ignore command because device is not ACTIVE.");
    return;
  }

  runtimeState = DeviceRuntimeState::ENROLLING;
  enrollState = EnrollState::FIND_EMPTY_SLOT;
  enrollStartedAtMs = millis();
  enrollTargetId = 0;
}

bool connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  if (mqttClient.connected()) {
    return true;
  }

  if (millis() - lastMqttReconnectAttemptMs < kMqttReconnectIntervalMs) {
    return false;
  }

  lastMqttReconnectAttemptMs = millis();

  const String mac = network.getMacAddress();
  mqttCommandTopic = buildMqttTopicFromMac(mac);
  const String clientId = buildMqttClientIdFromMac(mac);

  Serial.printf("[MQTT] Target broker=%s:%u clientId=%s\n",
                currentConfig.serverIp.c_str(), kMqttPort, clientId.c_str());

  mqttClient.setServer(currentConfig.serverIp.c_str(), kMqttPort);
  mqttClient.setCallback(onMqttMessage);

  const bool connected = mqttClient.connect(clientId.c_str());
  if (!connected) {
    Serial.printf("[MQTT] Connect failed. rc=%d\n", mqttClient.state());
    return false;
  }

  const bool subscribed = mqttClient.subscribe(mqttCommandTopic.c_str(), 1);
  Serial.printf("[MQTT] Connected. Subscribe %s -> %s\n",
                mqttCommandTopic.c_str(), subscribed ? "OK" : "FAILED");
  return subscribed;
}

uint8_t findFirstFreeTemplateId() {
  for (uint8_t id = 1; id <= kFingerprintMaxTemplateId; id++) {
    const uint8_t result = finger.loadModel(id);
    if (result != FINGERPRINT_OK) {
      return id;
    }
  }

  return 0;
}

void processEnrollStateMachine() {
  if (runtimeState != DeviceRuntimeState::ENROLLING) {
    return;
  }

  if (millis() - enrollStartedAtMs > kEnrollTimeoutMs &&
      enrollState != EnrollState::SUCCESS &&
      enrollState != EnrollState::FAILED) {
    Serial.println("[Enroll] Timeout.");
    failEnrollment();
    return;
  }

  if (enrollState == EnrollState::FIND_EMPTY_SLOT) {
    enrollTargetId = findFirstFreeTemplateId();
    if (enrollTargetId == 0) {
      Serial.println("[Enroll] No free fingerprint slot found.");
      failEnrollment();
      return;
    }

    display.showEnrollModePlaceFinger();
    enrollState = EnrollState::WAIT_FINGER_1;
    return;
  }

  if (enrollState == EnrollState::WAIT_FINGER_1) {
    const uint8_t imageResult = finger.getImage();
    if (imageResult == FINGERPRINT_NOFINGER) {
      return;
    }

    if (imageResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] First getImage failed: %u\n", imageResult);
      failEnrollment();
      return;
    }

    const uint8_t tzResult = finger.image2Tz(1);
    if (tzResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] First image2Tz failed: %u\n", tzResult);
      failEnrollment();
      return;
    }

    display.showEnrollModeRemoveFinger();
    enrollState = EnrollState::WAIT_REMOVE;
    return;
  }

  if (enrollState == EnrollState::WAIT_REMOVE) {
    const uint8_t imageResult = finger.getImage();
    if (imageResult != FINGERPRINT_NOFINGER) {
      return;
    }

    display.showEnrollModePlaceSameFinger();
    enrollState = EnrollState::WAIT_FINGER_2;
    return;
  }

  if (enrollState == EnrollState::WAIT_FINGER_2) {
    const uint8_t imageResult = finger.getImage();
    if (imageResult == FINGERPRINT_NOFINGER) {
      return;
    }

    if (imageResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] Second getImage failed: %u\n", imageResult);
      failEnrollment();
      return;
    }

    const uint8_t tzResult = finger.image2Tz(2);
    if (tzResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] Second image2Tz failed: %u\n", tzResult);
      failEnrollment();
      return;
    }

    const uint8_t modelResult = finger.createModel();
    if (modelResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] createModel failed: %u\n", modelResult);
      failEnrollment();
      return;
    }

    const uint8_t storeResult = finger.storeModel(enrollTargetId);
    if (storeResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] storeModel failed: %u\n", storeResult);
      failEnrollment();
      return;
    }

    succeedEnrollment();
    return;
  }

  if ((enrollState == EnrollState::SUCCESS || enrollState == EnrollState::FAILED) &&
      millis() - enrollResultShownAtMs >= 1500) {
    resetEnrollFlow();
    showHomeScreenByRemoteStatus();
  }
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

  fingerprintSensorReady = tryInitFingerprintSensor(true);
  connectMQTT();

  runAutoRegistration();

  lastRegisterAttemptMs = millis();
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

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected. Trying to reconnect...");
    if (!network.connectStation(currentConfig, kWifiConnectTimeoutMs)) {
      Serial.println("[WiFi] Reconnect failed. Switching to portal mode.");
      enterPortalMode();
      return;
    }

    connectMQTT();

    if (registrationState != RegistrationState::SUCCESS) {
      runAutoRegistration();
    }
  }

  connectMQTT();
  if (mqttClient.connected()) {
    mqttClient.loop();
  }

  if (!fingerprintSensorReady) {
    tryInitFingerprintSensor(false);
  }

  if (registrationState == RegistrationState::FAILED &&
      consumeBootShortPressEvent()) {
    Serial.println("[Register] BOOT short press detected. Retrying registration...");
    runAutoRegistration();
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
      remoteDeviceStatus == NetworkManager::RemoteDeviceStatus::ACTIVE) {
    processEnrollStateMachine();
  }

  delay(20);
}
