#pragma once

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFi.h>

#include "ConfigStore.h"

class NetworkManager {
 public:
  enum class RemoteDeviceStatus : uint8_t {
    UNKNOWN,
    ACTIVE,
    INACTIVE,
    MAINTENANCE,
  };

  struct RegisterHeartbeatResult {
    bool ok;
    int httpStatusCode;
    RemoteDeviceStatus remoteStatus;
  };

  bool connectStation(const DeviceConfig &config, uint32_t timeoutMs);
  void startConfigAp(const String &ssid);
  String apIpAddress() const;
  String getMacAddress() const;

  int getLastHttpStatusCode() const;
  RemoteDeviceStatus getLastRemoteStatus() const;

  RegisterHeartbeatResult autoRegisterDevice(const DeviceConfig &config,
                                             const String &apiKey) const;
  bool sendFingerprintCallback(const DeviceConfig &config, const String &apiKey,
                               const String &fingerprintId) const;

 private:
  String buildBaseUrl(const DeviceConfig &config) const;
  String buildAuthorization(const String &apiKey) const;
  RemoteDeviceStatus parseRemoteStatus(const String &status) const;
  bool postJson(const DeviceConfig &config, const String &apiKey,
                const String &endpoint, const String &payload) const;

  mutable int lastHttpStatusCode_ = 0;
  mutable RemoteDeviceStatus lastRemoteStatus_ = RemoteDeviceStatus::UNKNOWN;
};
