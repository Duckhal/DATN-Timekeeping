#include "services/ConfigService.h"

namespace tk::services {
namespace {
constexpr const char* kNamespace = "tk_cfg";
constexpr const char* kKeySsid = "ssid";
constexpr const char* kKeyPass = "pass";
constexpr const char* kKeyServerIp = "srv_ip";
constexpr const char* kKeyServerPort = "srv_port";
constexpr const char* kKeyDeviceName = "dev_name";
}  // namespace

bool ConfigService::begin() {
  return store_.begin(kNamespace, false);
}

models::DeviceConfig ConfigService::load() const {
  models::DeviceConfig config;
  config.ssid = store_.getString(kKeySsid, config::network::kDefaultSsid);
  config.password = store_.getString(kKeyPass, config::network::kDefaultPassword);
  config.serverIp = store_.getString(kKeyServerIp, config::network::kDefaultServerIp);
  config.serverPort =
      store_.getUShort(kKeyServerPort, config::network::kDefaultServerPort);
  config.deviceName = store_.getString(kKeyDeviceName, config::network::kDefaultDeviceName);
  return config;
}

bool ConfigService::save(const models::DeviceConfig& config) {
  bool ok = true;
  ok = ok && store_.putString(kKeySsid, config.ssid);
  ok = ok && store_.putString(kKeyPass, config.password);
  ok = ok && store_.putString(kKeyServerIp, config.serverIp);
  ok = ok && store_.putUShort(kKeyServerPort, config.serverPort);
  ok = ok && store_.putString(kKeyDeviceName, config.deviceName);
  return ok;
}

bool ConfigService::clearAll() {
  return store_.clear();
}
}  // namespace tk::services
