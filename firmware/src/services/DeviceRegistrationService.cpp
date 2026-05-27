#include "services/DeviceRegistrationService.h"

namespace tk::services {
DeviceRegistrationService::DeviceRegistrationService(NetworkService& network, DisplayService& display)
    : network_(network),
      display_(display),
      state_(State::PENDING),
      remoteStatus_(models::RemoteDeviceStatus::UNKNOWN),
      lastRegisterAttemptMs_(0) {}

DeviceRegistrationService::TickResult DeviceRegistrationService::runNow(
    const models::DeviceConfig& config, const String& apiKey) {
  const models::RegisterHeartbeatResult registerResult =
      network_.autoRegisterDevice(config, apiKey);

  const int lastStatusCode = registerResult.httpStatusCode;
  Serial.printf("[Register] Register result: %s\n", registerResult.ok ? "SUCCESS" : "FAILED");
  Serial.printf("[Register] Last HTTP status: %d\n", lastStatusCode);

  if (lastStatusCode == 403 || lastStatusCode == 404) {
    return TickResult::REMOTE_WIPE;
  }

  if (!registerResult.ok) {
    state_ = State::FAILED;
    remoteStatus_ = models::RemoteDeviceStatus::UNKNOWN;
    display_.showServerConnectionFailed(lastStatusCode);
    return TickResult::NONE;
  }

  state_ = State::SUCCESS;
  showRemoteModeIfChanged(registerResult.remoteStatus);
  lastRegisterAttemptMs_ = millis();
  return TickResult::NONE;
}

DeviceRegistrationService::TickResult DeviceRegistrationService::tick(
  const models::DeviceConfig& config, const String& apiKey, uint32_t intervalMs) {
  if (state_ != State::SUCCESS) {
    return TickResult::NONE;
  }

  const uint32_t now = millis();
  if (now - lastRegisterAttemptMs_ < intervalMs) {
    return TickResult::NONE;
  }

  return runNow(config, apiKey);
}

DeviceRegistrationService::State DeviceRegistrationService::state() const {
  return state_;
}

models::RemoteDeviceStatus DeviceRegistrationService::remoteStatus() const {
  return remoteStatus_;
}

void DeviceRegistrationService::applyRemoteStatus(models::RemoteDeviceStatus status) {
  showRemoteModeIfChanged(status);
}

void DeviceRegistrationService::showCurrentHomeScreen() const {
  if (remoteStatus_ == models::RemoteDeviceStatus::ACTIVE) {
    display_.showWelcome();
    return;
  }

  if (remoteStatus_ == models::RemoteDeviceStatus::INACTIVE) {
    display_.showInactiveMode();
    return;
  }

  if (remoteStatus_ == models::RemoteDeviceStatus::MAINTENANCE) {
    display_.showMaintenanceMode();
    return;
  }
}

void DeviceRegistrationService::showRemoteModeIfChanged(
  models::RemoteDeviceStatus nextStatus) {
  if (remoteStatus_ == nextStatus) {
    return;
  }

  remoteStatus_ = nextStatus;

  if (nextStatus == models::RemoteDeviceStatus::ACTIVE) {
    display_.showConnectedSuccessfully();
    delay(1000);
    display_.showWelcome();
    return;
  }

  if (nextStatus == models::RemoteDeviceStatus::INACTIVE) {
    display_.showInactiveMode();
    return;
  }

  if (nextStatus == models::RemoteDeviceStatus::MAINTENANCE) {
    display_.showMaintenanceMode();
    return;
  }
}
}  // namespace tk::services
