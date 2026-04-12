#pragma once

#include <Arduino.h>
#include <Preferences.h>

struct DeviceConfig {
  String ssid;
  String password;
  String serverIp;
  uint16_t serverPort;

  bool isValid() const {
    return ssid.length() > 0 && serverIp.length() > 0 && serverPort > 0;
  }
};

class ConfigStore {
 public:
  bool begin();
  DeviceConfig load() const;
  bool save(const DeviceConfig &config);
  bool clearAll();

 private:
  static constexpr const char *kNamespace = "tk_cfg";
  static constexpr const char *kKeySsid = "ssid";
  static constexpr const char *kKeyPass = "pass";
  static constexpr const char *kKeyServerIp = "srv_ip";
  static constexpr const char *kKeyServerPort = "srv_port";

  mutable Preferences preferences_;
};
