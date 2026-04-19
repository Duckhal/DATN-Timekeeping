#include "app/App.h"

namespace tk::app {
App::App()
  : portalDriver_(80),
      mqttService_(mqttDriver_),
      fingerSerial_(2),
      fingerprintDriver_(fingerSerial_, config::gpio::kFingerprintRx,
                         config::gpio::kFingerprintTx,
                         config::fingerprint::kBaudRate),
      enrollmentService_(fingerprintDriver_, displayService_, networkService_),
      registrationService_(networkService_, displayService_),
      bootButtonDriver_(config::gpio::kBootButtonPin,
                        config::timing::kBootDebounceMs,
                        config::timing::kBootShortPressMinMs,
                        config::timing::kBootHoldToResetMs),
      currentConfig_{},
      isPortalMode_(false),
      shouldRestartAfterSave_(false),
      restartScheduledAtMs_(0) {}

void App::begin() {
  Serial.begin(115200);
  delay(300);

  bootButtonDriver_.begin();
  displayService_.begin();
  mqttService_.begin();

  if (!configService_.begin()) {
    Serial.println("[Config] Preferences init failed. Entering portal mode.");
    enterPortalMode();
    return;
  }

  currentConfig_ = configService_.load();
  if (!currentConfig_.isValid()) {
    Serial.println("[Config] No valid saved configuration found.");
    enterPortalMode();
    return;
  }

  Serial.printf("[WiFi] Connecting to SSID=%s\n", currentConfig_.ssid.c_str());
  const bool connected =
      networkService_.connectStation(currentConfig_, config::timing::kWifiConnectTimeoutMs);

  if (!connected) {
    Serial.println("[WiFi] Failed to connect within timeout.");
    enterPortalMode();
    return;
  }

  Serial.println("[WiFi] Connected successfully.");
  Serial.printf("[WiFi] IP Address: %s\n", networkService_.localIpAddress().c_str());
  Serial.printf("[WiFi] MAC Address: %s\n", networkService_.macAddress().c_str());

  enrollmentService_.initSensor(true, config::timing::kFingerprintRetryIntervalMs);

  mqttService_.connectIfNeeded(currentConfig_.serverIp, networkService_.macAddress(),
                               config::network::kMqttPort,
                               config::timing::kMqttReconnectIntervalMs);

  handleRegistrationResult(
      registrationService_.runNow(currentConfig_, config::network::kDeviceApiKey));
}

void App::tick() {
  const drivers::BootButtonDriver::Event buttonEvent = bootButtonDriver_.update();

  if (buttonEvent.longPress) {
    clearSettingsAndReboot();
    return;
  }

  if (isPortalMode_) {
    portalDriver_.handleClient();

    if (shouldRestartAfterSave_ && millis() - restartScheduledAtMs_ >= 800) {
      ESP.restart();
    }

    delay(20);
    return;
  }

  if (networkService_.wifiStatus() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected. Trying to reconnect...");
    if (!networkService_.connectStation(currentConfig_, config::timing::kWifiConnectTimeoutMs)) {
      Serial.println("[WiFi] Reconnect failed. Switching to portal mode.");
      enterPortalMode();
      return;
    }

    mqttService_.connectIfNeeded(currentConfig_.serverIp, networkService_.macAddress(),
                                 config::network::kMqttPort,
                                 config::timing::kMqttReconnectIntervalMs);

    if (registrationService_.state() != services::DeviceRegistrationService::State::SUCCESS) {
      handleRegistrationResult(
          registrationService_.runNow(currentConfig_, config::network::kDeviceApiKey));
    }
  }

  mqttService_.connectIfNeeded(currentConfig_.serverIp, networkService_.macAddress(),
                               config::network::kMqttPort,
                               config::timing::kMqttReconnectIntervalMs);
  mqttService_.loop();

  if (!enrollmentService_.sensorReady()) {
    enrollmentService_.initSensor(false, config::timing::kFingerprintRetryIntervalMs);
  }

  if (buttonEvent.shortPress &&
      registrationService_.state() == services::DeviceRegistrationService::State::FAILED) {
    Serial.println("[Register] BOOT short press detected. Retrying registration...");
    handleRegistrationResult(
        registrationService_.runNow(currentConfig_, config::network::kDeviceApiKey));
  }

  handleRegistrationResult(registrationService_.tick(
      currentConfig_, config::network::kDeviceApiKey,
      config::timing::kRegisterIntervalMs));

  if (mqttService_.consumeEnrollCommand()) {
    enrollmentService_.initSensor(true, config::timing::kFingerprintRetryIntervalMs);
    enrollmentService_.startIfAllowed(
        registrationService_.remoteStatus() == models::RemoteDeviceStatus::ACTIVE);
  }

  if (registrationService_.state() == services::DeviceRegistrationService::State::SUCCESS &&
      registrationService_.remoteStatus() == models::RemoteDeviceStatus::ACTIVE) {
    enrollmentService_.tick(currentConfig_, config::network::kDeviceApiKey,
                            config::timing::kEnrollTimeoutMs,
                            config::fingerprint::kMaxTemplateId);
  }

  delay(20);
}

String App::buildPortalSsidFromMac(const String& macAddress) const {
  String compactMac = macAddress;
  compactMac.replace(":", "");
  return String(config::portal::kPortalSsidPrefix) + compactMac;
}

void App::scheduleRestart() {
  shouldRestartAfterSave_ = true;
  restartScheduledAtMs_ = millis();
}

void App::enterPortalMode() {
  const String apSsid = buildPortalSsidFromMac(networkService_.macAddress());
  networkService_.startConfigAp(apSsid);

  displayService_.showNotConnected(apSsid, config::portal::kDefaultPortalIp);

  portalDriver_.begin([this](const models::DeviceConfig& config) {
    const bool saved = configService_.save(config);
    if (!saved) {
      Serial.println("[Config] Failed to save configuration.");
      return;
    }

    Serial.println("[Config] Configuration saved. Restart is scheduled.");
    scheduleRestart();
  });

  isPortalMode_ = true;
  Serial.printf("[AP] Portal started. SSID=%s IP=%s\n", apSsid.c_str(),
                networkService_.apIpAddress().c_str());
}

void App::clearSettingsAndReboot() {
  Serial.println("[Reset] BOOT button held for 5s. Clearing settings...");

  displayService_.showNotifyingServer();

  if (currentConfig_.isValid()) {
    const bool notifyOk = networkService_.notifyFactoryReset(
        currentConfig_, String(config::network::kDeviceApiKey), 3000);
    Serial.printf("[FactoryReset] Notify result: %s\n",
                  notifyOk ? "SUCCESS" : "FAILED");
  } else {
    Serial.println("[FactoryReset] Skip notify because runtime config is invalid.");
  }

  configService_.clearAll();
  displayService_.showSettingsCleared();
  delay(1200);
  ESP.restart();
}

void App::performRemoteWipeAndReboot() {
  Serial.println("[RemoteWipe] Device denied by server (403/404). Resetting local config...");
  displayService_.showDeviceDeletedFactoryResetting();
  configService_.clearAll();
  delay(2000);
  ESP.restart();
}

void App::handleRegistrationResult(services::DeviceRegistrationService::TickResult result) {
  if (result == services::DeviceRegistrationService::TickResult::REMOTE_WIPE) {
    performRemoteWipeAndReboot();
  }
}
}  // namespace tk::app
