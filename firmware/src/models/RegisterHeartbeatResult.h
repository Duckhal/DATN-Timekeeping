#pragma once

namespace tk::models {
enum class RemoteDeviceStatus : unsigned char {
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
}  // namespace tk::models
