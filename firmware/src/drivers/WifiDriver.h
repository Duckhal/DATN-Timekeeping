#pragma once

#include <Arduino.h>
#include <WiFi.h>

namespace tk::drivers {
class WifiDriver {
 public:
  bool connectStation(const String& ssid, const String& password, uint32_t timeoutMs);
  void startAccessPoint(const String& ssid);

  wl_status_t status() const;
  String localIpAddress() const;
  String apIpAddress() const;
  String macAddress() const;
};
}  // namespace tk::drivers
