#pragma once

#include <WiFi.h>

#include "drivers/HttpClientDriver.h"
#include "drivers/WifiDriver.h"
#include "models/DeviceConfig.h"
#include "models/RegisterHeartbeatResult.h"

namespace tk::services {
class NetworkService {
 public:
  bool connectStation(const models::DeviceConfig& config, uint32_t timeoutMs);
  void startConfigAp(const String& ssid);

  wl_status_t wifiStatus() const;
  String localIpAddress() const;
  String apIpAddress() const;
  String macAddress() const;

  int getLastHttpStatusCode() const;
  models::RemoteDeviceStatus getLastRemoteStatus() const;

  models::RegisterHeartbeatResult autoRegisterDevice(
      const models::DeviceConfig& config,
      const String& apiKey);

  bool notifyFactoryReset(const models::DeviceConfig& config,
                          const String& apiKey,
                          uint32_t timeoutMs);

  bool sendFingerprintCallback(const models::DeviceConfig& config,
                               const String& apiKey,
                               const String& fingerprintId);

 private:
  String buildBaseUrl(const models::DeviceConfig& config) const;
  String buildAuthorization(const String& apiKey) const;
  models::RemoteDeviceStatus parseRemoteStatus(const String& status) const;

  drivers::WifiDriver wifi_;
  drivers::HttpClientDriver http_;
  int lastHttpStatusCode_ = 0;
  models::RemoteDeviceStatus lastRemoteStatus_ = models::RemoteDeviceStatus::UNKNOWN;
};
}  // namespace tk::services
