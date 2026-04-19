#pragma once

#include "Config/Config.h"
#include "drivers/PreferencesDriver.h"
#include "models/DeviceConfig.h"

namespace tk::services {
class ConfigService {
 public:
  bool begin();
  models::DeviceConfig load() const;
  bool save(const models::DeviceConfig& config);
  bool clearAll();

 private:
  drivers::PreferencesDriver store_;
};
}  // namespace tk::services
