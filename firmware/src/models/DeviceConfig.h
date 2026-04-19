#pragma once

#include <Arduino.h>

namespace tk::models {
struct DeviceConfig {
  String ssid;
  String password;
  String serverIp;
  uint16_t serverPort;
  String deviceName;

  bool isValid() const {
    return ssid.length() > 0 && password.length() > 0 &&
           serverIp.length() > 0 && serverPort > 0 &&
           deviceName.length() > 0;
  }
};
}  // namespace tk::models
