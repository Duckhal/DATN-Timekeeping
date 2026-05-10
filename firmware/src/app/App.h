#pragma once

#include "Config/Config.h"
#include "drivers/BootButtonDriver.h"
#include "drivers/FingerprintDriver.h"
#include "drivers/MqttClientDriver.h"
#include "drivers/PortalDriver.h"
#include "models/DeviceConfig.h"
#include "services/ConfigService.h"
#include "services/CheckinService.h"
#include "services/DeviceRegistrationService.h"
#include "services/DisplayService.h"
#include "services/EnrollmentService.h"
#include "services/MqttService.h"
#include "services/NetworkService.h"
#include "services/SyncMappingService.h"

namespace tk::app {
class App {
 public:
  App();

  void begin();
  void tick();

 private:
  String buildPortalSsidFromMac(const String& macAddress) const;
  void scheduleRestart();
  void enterPortalMode();
  void clearSettingsAndReboot();
  void performRemoteWipeAndReboot();
  void handleRegistrationResult(services::DeviceRegistrationService::TickResult result);

  services::DisplayService displayService_;
  services::ConfigService configService_;
  services::NetworkService networkService_;
  drivers::PortalDriver portalDriver_;

  drivers::MqttClientDriver mqttDriver_;
  services::MqttService mqttService_;

  HardwareSerial fingerSerial_;
  drivers::FingerprintDriver fingerprintDriver_;
  services::EnrollmentService enrollmentService_;
  services::SyncMappingService syncMappingService_;
  services::CheckinService checkinService_;

  services::DeviceRegistrationService registrationService_;
  drivers::BootButtonDriver bootButtonDriver_;

  models::DeviceConfig currentConfig_;

  bool isPortalMode_;
  bool shouldRestartAfterSave_;
  uint32_t restartScheduledAtMs_;
};
}  // namespace tk::app
