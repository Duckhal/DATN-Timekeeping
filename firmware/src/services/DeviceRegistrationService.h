#pragma once

#include "models/DeviceConfig.h"
#include "models/RegisterHeartbeatResult.h"
#include "services/DisplayService.h"
#include "services/NetworkService.h"

namespace tk::services {
class DeviceRegistrationService {
 public:
  enum class State : uint8_t {
    PENDING,
    FAILED,
    SUCCESS,
  };

  enum class TickResult : uint8_t {
    NONE,
    REMOTE_WIPE,
  };

  explicit DeviceRegistrationService(NetworkService& network, DisplayService& display);

  TickResult runNow(const models::DeviceConfig& config, const String& apiKey);
  TickResult tick(const models::DeviceConfig& config, const String& apiKey, uint32_t intervalMs);

  State state() const;
  models::RemoteDeviceStatus remoteStatus() const;
  void applyRemoteStatus(models::RemoteDeviceStatus status);

  void showCurrentHomeScreen() const;

 private:
  void showRemoteModeIfChanged(models::RemoteDeviceStatus nextStatus);

  NetworkService& network_;
  DisplayService& display_;
  State state_;
  models::RemoteDeviceStatus remoteStatus_;
  uint32_t lastRegisterAttemptMs_;
};
}  // namespace tk::services
