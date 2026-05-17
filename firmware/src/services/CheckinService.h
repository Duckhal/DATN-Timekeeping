#pragma once

#include <Arduino.h>

#include "drivers/FingerprintDriver.h"
#include "models/DeviceConfig.h"
#include "services/DisplayService.h"
#include "services/NetworkService.h"

namespace tk::services {

/**
 * Continuously polls the sensor for a match and POSTs /devices/checkin.
 *
 * Responsibilities:
 *  - Skip entirely when the device isn't ACTIVE or enrollment is in progress.
 *  - Debounce: after a successful or denied check-in, hold the result screen
 *    for a short window and require the finger to be lifted before accepting
 *    the next scan (prevents double-posts from a single press).
 *  - Ghost recovery: when backend answers `action=FORCE_DELETE_LOCAL`, call
 *    FingerprintDriver::deleteModel to clean the orphan slot.
 */
class CheckinService {
 public:
  CheckinService(drivers::FingerprintDriver& fingerprint,
                 DisplayService& display,
                 NetworkService& network);

  /** Call each App::tick() when normal operation is permitted. */
  void tick(const models::DeviceConfig& config,
            const String& apiKey,
            bool allowed);
  bool isBusy() const;

 private:
  enum class State : uint8_t {
    IDLE,
    SHOWING_RESULT,
    WAIT_FINGER_RELEASE,
  };

  String generateClientTxId(uint16_t localId) const;
  void parseAndApply(uint16_t matchedId, const String& body);
  void enterResultState();

  drivers::FingerprintDriver& fingerprint_;
  DisplayService& display_;
  NetworkService& network_;

  State state_;
  uint32_t resultShownAtMs_;
  uint16_t lastMatchedId_;
};

}  // namespace tk::services
