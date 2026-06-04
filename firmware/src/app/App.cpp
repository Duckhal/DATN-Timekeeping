#include "app/App.h"

namespace tk::app {
App::App()
  : portalDriver_(80),
      mqttService_(mqttDriver_),
      fingerSerial_(2),
      fingerprintDriver_(fingerSerial_, config::gpio::kFingerprintRx,
                         config::gpio::kFingerprintTx,
                         config::fingerprint::kBaudRate),
  rfidDriver_(config::gpio::kRfidSck,
      config::gpio::kRfidMiso,
      config::gpio::kRfidMosi,
      config::gpio::kRfidCs,
      config::gpio::kRfidRst),
      buzzerDriver_(config::gpio::kBuzzerPin),
      enrollmentService_(fingerprintDriver_, displayService_, networkService_),
      syncMappingService_(fingerprintDriver_, networkService_),
      bulkSyncService_(fingerprintDriver_, networkService_, displayService_),
      checkinService_(fingerprintDriver_, displayService_, networkService_, buzzerDriver_),
  rfidService_(rfidDriver_, displayService_, networkService_, buzzerDriver_),
      registrationService_(networkService_, displayService_),
      bootButtonDriver_(config::gpio::kBootButtonPin,
                        config::timing::kBootDebounceMs,
                        config::timing::kBootShortPressMinMs,
                        config::timing::kBootHoldToResetMs),
      currentConfig_{},
      isPortalMode_(false),
      shouldRestartAfterSave_(false),
  restartScheduledAtMs_(0),
  processingCheckin_(false) {}

void App::begin() {
  Serial.begin(115200);
  delay(300);

  displayService_.begin();
  Serial.println("[App] Starting ordered boot process...");

  bootButtonDriver_.begin();
  buzzerDriver_.begin();
  displayService_.showBootLog("System Drivers... OK", 20, ST77XX_GREEN);
  delay(150); 

  displayService_.showBootLog("Fingerprint... Connecting", 50, ST77XX_WHITE);
  bool fingerVerified = enrollmentService_.initSensor(true, config::timing::kFingerprintRetryIntervalMs);
  if (fingerVerified) {
    displayService_.showBootLog("Fingerprint... OK", 50, ST77XX_GREEN);
  } else {
    displayService_.showBootLog("Fingerprint... FAILED", 50, ST77XX_RED);
  }
  delay(150);

  rfidService_.begin();
  displayService_.showBootLog("RFID Module... OK", 80, ST77XX_GREEN);
  delay(150);

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

  displayService_.showBootLog("Wi-Fi... Connecting", 110, ST77XX_WHITE);
  const bool connected = networkService_.connectStation(currentConfig_, config::timing::kWifiConnectTimeoutMs);
  if (!connected) {
    displayService_.showBootLog("Wi-Fi... FAILED", 110, ST77XX_RED);
    delay(1000);
    enterPortalMode();
    return;
  }
  displayService_.showBootLog("Wi-Fi... OK", 110, ST77XX_GREEN);
  delay(150);

  mqttService_.begin();
  displayService_.showBootLog("MQTT... Connecting", 140, ST77XX_WHITE);
  mqttService_.connectIfNeeded(currentConfig_.serverIp, networkService_.macAddress(),
                               config::network::kMqttPort,
                               config::timing::kMqttReconnectIntervalMs);
                               
  if (mqttService_.connected()) {
    displayService_.showBootLog("MQTT... OK", 140, ST77XX_GREEN);
  } else {
    displayService_.showBootLog("MQTT... FAILED", 140, ST77XX_RED);
  }
  delay(150);

  displayService_.showBootLog("Server... Connecting", 170, ST77XX_WHITE);
  services::DeviceRegistrationService::TickResult regResult = 
      registrationService_.runNow(currentConfig_, config::network::kDeviceApiKey);
  if (registrationService_.state() == services::DeviceRegistrationService::State::SUCCESS) {
    displayService_.showBootLog("Server... OK", 170, ST77XX_GREEN);
    registrationService_.showCurrentHomeScreen();
  } else {
    displayService_.showBootLog("Server... FAILED", 170, ST77XX_RED);
  }
  delay(150);

  handleRegistrationResult(regResult);
}

void App::tick() {
  buzzerDriver_.update();
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

    // In Portal mode, periodically check if the saved Wi-Fi SSID is available again to allow auto-recovery without user intervention.
    static uint32_t lastPortalWifiCheckMs = 0;
    if (millis() - lastPortalWifiCheckMs >= config::timing::kPortalRetryWifiIntervalMs) {
      lastPortalWifiCheckMs = millis();
      Serial.println("[Portal-Recovery] Background scanning for old Wi-Fi SSID...");
      
      // Scan for Wi-Fi networks to see if the saved SSID is available again
      int n = WiFi.scanNetworks();
      bool foundOldWifi = false;
      
      for (int i = 0; i < n; ++i) {
        if (WiFi.SSID(i) == currentConfig_.ssid) {
          foundOldWifi = true;
          break;
        }
      }
      
      // Release memory used by Wi-Fi scan
      WiFi.scanDelete();

      if (foundOldWifi) {
        Serial.printf("[Portal-Recovery] Detected saved SSID: %s. Rebooting to reconnect...\n", currentConfig_.ssid.c_str());
        displayService_.showAutoWifiRecoveryAttempt(); // Show message before rebooting to indicate recovery attempt
        delay(500);
        ESP.restart(); // Restart for auto-recovery to attempt Wi-Fi connection with saved credentials
      } else {
        Serial.println("[Portal-Recovery] Saved SSID not found yet. Staying in Portal mode.");
      }
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

  {
    models::RemoteDeviceStatus mqttStatus;
    if (mqttService_.consumeStatusUpdate(mqttStatus)) {
      registrationService_.applyRemoteStatus(mqttStatus);
    }
  }

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

  uint32_t syncEmployeeId;
  String syncTemplateData;
  String syncSourceMac;
  if (mqttService_.consumeSyncCommand(syncEmployeeId, syncTemplateData, syncSourceMac)) {
    const String selfMac = networkService_.macAddress();
    const bool fromSelf =
        syncSourceMac.length() > 0 && syncSourceMac.equalsIgnoreCase(selfMac);

    if (fromSelf) {
      Serial.printf("[App] Ignore SYNC from self (mac=%s).\n", selfMac.c_str());
    } else {
      Serial.printf("[App] Processing SYNC command for Employee ID %lu (source=%s)\n",
                    (unsigned long)syncEmployeeId, syncSourceMac.c_str());

      if (!enrollmentService_.sensorReady()) {
        enrollmentService_.initSensor(true, config::timing::kFingerprintRetryIntervalMs);
      }

      if (!enrollmentService_.sensorReady()) {
        Serial.println("[App] SYNC ABORTED: Fingerprint sensor is not ready.");
      } else {
        const uint16_t freeSlot =
            fingerprintDriver_.findFirstFreeSlot(config::fingerprint::kMaxTemplateId);

        if (freeSlot == 0) {
          Serial.println("[App] SYNC ABORTED: No free fingerprint slot on this device.");
        } else {
          const bool stored =
              fingerprintDriver_.setTemplateFromHex(freeSlot, syncTemplateData);

          if (!stored) {
            Serial.printf("[App] SYNC FAILED to store template at slot=%u.\n", freeSlot);
          } else {
            Serial.printf("[App] SYNC stored template at slot=%u, queueing mapping callback.\n",
                          freeSlot);
            syncMappingService_.enqueue(syncEmployeeId, freeSlot);
          }
        }
      }
    }
  }

  syncMappingService_.tick(currentConfig_, config::network::kDeviceApiKey,
                           config::timing::kSyncMappingRetryIntervalMs,
                           config::timing::kSyncMappingMaxAttempts);

  if (mqttService_.consumeBulkSyncCommand()) {
    if (!bulkSyncService_.isSyncing()) {
      bulkSyncService_.startSync();
    }
  }
  bulkSyncService_.tick(currentConfig_, config::network::kDeviceApiKey);

  uint16_t deleteLocalId = 0;
  if (mqttService_.consumeDeleteFingerCommand(deleteLocalId)) {
    if (enrollmentService_.isEnrolling()) {
      Serial.println("[App] Ignore DELETE_FINGER while enrolling.");
    } else if (!enrollmentService_.sensorReady()) {
      enrollmentService_.initSensor(true, config::timing::kFingerprintRetryIntervalMs);
    }

    if (!enrollmentService_.isEnrolling() && enrollmentService_.sensorReady()) {
      const uint16_t result = fingerprintDriver_.deleteModel(deleteLocalId);
      Serial.printf("[App] DELETE_FINGER deleteModel(%u) -> %u\n", deleteLocalId, result);
    }
  }

  const bool checkinAllowed =
      registrationService_.state() == services::DeviceRegistrationService::State::SUCCESS &&
      registrationService_.remoteStatus() == models::RemoteDeviceStatus::ACTIVE &&
      !enrollmentService_.isEnrolling() &&
      !bulkSyncService_.isSyncing() &&
      enrollmentService_.sensorReady();

  // Log gate state transitions once to avoid spamming the monitor.
  {
    static bool loggedOnce = false;
    static bool lastAllowed = false;
    static bool lastProcessing = false;
    static bool lastSensorReady = false;
    static bool lastEnrolling = false;
    static services::DeviceRegistrationService::State lastRegState =
        services::DeviceRegistrationService::State::FAILED;
    static models::RemoteDeviceStatus lastRemoteStatus = models::RemoteDeviceStatus::UNKNOWN;

    const bool sensorReady = enrollmentService_.sensorReady();
    const bool enrolling = enrollmentService_.isEnrolling();
    const services::DeviceRegistrationService::State regState = registrationService_.state();
    const models::RemoteDeviceStatus remoteStatus = registrationService_.remoteStatus();

    if (!loggedOnce || checkinAllowed != lastAllowed || processingCheckin_ != lastProcessing ||
        sensorReady != lastSensorReady || enrolling != lastEnrolling ||
        regState != lastRegState || remoteStatus != lastRemoteStatus) {
      Serial.printf(
          "[RFID] Gate allowed=%d processing=%d reg=%d remote=%d sensorReady=%d enrolling=%d\n",
          checkinAllowed,
          processingCheckin_,
          static_cast<int>(regState),
          static_cast<int>(remoteStatus),
          sensorReady,
          enrolling);
      loggedOnce = true;
      lastAllowed = checkinAllowed;
      lastProcessing = processingCheckin_;
      lastSensorReady = sensorReady;
      lastEnrolling = enrolling;
      lastRegState = regState;
      lastRemoteStatus = remoteStatus;
    }
  }

  if (!processingCheckin_ && checkinAllowed) {
    rfidService_.tick(currentConfig_, config::network::kDeviceApiKey, true);
    if (!rfidService_.isBusy()) {
      checkinService_.tick(currentConfig_, config::network::kDeviceApiKey, true);
    }
  } else {
    rfidService_.tick(currentConfig_, config::network::kDeviceApiKey, false);
    checkinService_.tick(currentConfig_, config::network::kDeviceApiKey, false);
  }

  processingCheckin_ = rfidService_.isBusy() || checkinService_.isBusy();

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
