#pragma once

#include <Adafruit_ST7789.h>

#include "Config/Config.h"
#include "drivers/TftDriver.h"

namespace tk::services {
class DisplayService {
 public:
   DisplayService();

  void begin();

  void showBootLog(const String& message, uint16_t yOffset, uint16_t color);
  void showNotConnected(const String& apSsid, const String& portalIp);
  void showServerConnectionFailed(int httpStatusCode);
  void showConnectedSuccessfully();
  void showInactiveMode();
  void showMaintenanceMode();
  void showNotifyingServer();
  void showAutoWifiRecoveryAttempt();
  void showDeviceDeletedFactoryResetting();
  void showEnrollModePlaceFinger();
  void showEnrollModeRemoveFinger();
  void showEnrollModePlaceSameFinger();
  void showEnrollSuccess(uint16_t id);
  void showEnrollFailed();
  void showWelcome();
  void showSettingsCleared();
  void showCheckinSuccess(const String& employeeName);
  void showCheckinDenied();
  void showAlreadyCheckedIn(const String& employeeName);
  void showCardNotRecognized();
  void showBulkSyncProgress(uint16_t count);
  void showBulkSyncComplete(uint16_t count);
  void showBulkSyncFailed();

 private:
   drivers::TftDriver display_;
};
}  // namespace tk::services
