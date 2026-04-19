#pragma once

#include <Adafruit_ST7789.h>

#include "Config/Config.h"
#include "drivers/TftDriver.h"

namespace tk::services {
class DisplayService {
 public:
   DisplayService();

  void begin();

  void showNotConnected(const String& apSsid, const String& portalIp);
  void showServerConnectionFailed(int httpStatusCode);
  void showConnectedSuccessfully();
  void showInactiveMode();
  void showMaintenanceMode();
  void showNotifyingServer();
  void showDeviceDeletedFactoryResetting();
  void showEnrollModePlaceFinger();
  void showEnrollModeRemoveFinger();
  void showEnrollModePlaceSameFinger();
  void showEnrollSuccess(uint16_t id);
  void showEnrollFailed();
  void showWelcome();
  void showSettingsCleared();

 private:
   drivers::TftDriver display_;
};
}  // namespace tk::services
