#include "ConfigStore.h"

bool ConfigStore::begin() {
  return preferences_.begin(kNamespace, false);
}

DeviceConfig ConfigStore::load() const {
  DeviceConfig config;
  config.ssid = preferences_.getString(kKeySsid, "");
  config.password = preferences_.getString(kKeyPass, "");
  config.serverIp = preferences_.getString(kKeyServerIp, "");
  config.serverPort = static_cast<uint16_t>(preferences_.getUShort(kKeyServerPort, 3000));
  return config;
}

bool ConfigStore::save(const DeviceConfig &config) {
  bool ok = true;
  ok = ok && preferences_.putString(kKeySsid, config.ssid) == config.ssid.length();
  ok = ok && preferences_.putString(kKeyPass, config.password) == config.password.length();
  ok = ok &&
       preferences_.putString(kKeyServerIp, config.serverIp) ==
           config.serverIp.length();
  ok = ok && preferences_.putUShort(kKeyServerPort, config.serverPort) > 0;
  return ok;
}

bool ConfigStore::clearAll() {
  return preferences_.clear();
}
