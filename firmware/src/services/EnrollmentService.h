#pragma once

#include "drivers/FingerprintDriver.h"
#include "models/DeviceConfig.h"
#include "services/DisplayService.h"
#include "services/NetworkService.h"

namespace tk::services {
class EnrollmentService {
 public:
  enum class RuntimeState : uint8_t {
    NORMAL,
    ENROLLING,
  };

  enum class State : uint8_t {
    IDLE,
    FIND_EMPTY_SLOT,
    WAIT_FINGER_1,
    WAIT_REMOVE,
    WAIT_FINGER_2,
    SUCCESS,
    FAILED,
  };

  EnrollmentService(drivers::FingerprintDriver& fingerprint,
                    DisplayService& display,
                    NetworkService& network);

  bool initSensor(bool forceLog, uint32_t retryIntervalMs);
  bool sensorReady() const;
  bool isEnrolling() const { return runtimeState_ == RuntimeState::ENROLLING; }

  void startIfAllowed(bool isDeviceActive);
  void tick(const models::DeviceConfig& config,
            const String& apiKey,
            uint32_t enrollTimeoutMs,
            uint16_t maxTemplateId);

 private:
  uint16_t findFirstFreeTemplateId(uint16_t maxTemplateId);
  void failEnrollment();
  void succeedEnrollment(const models::DeviceConfig& config,
                         const String& apiKey,
                         const String& templateData);

  drivers::FingerprintDriver& fingerprint_;
  DisplayService& display_;
  NetworkService& network_;

  RuntimeState runtimeState_;
  State state_;
  bool sensorReady_;
  uint16_t targetId_;
  uint32_t enrollStartedAtMs_;
  uint32_t enrollResultShownAtMs_;
  uint32_t lastSensorInitAttemptMs_;
};
}  // namespace tk::services
