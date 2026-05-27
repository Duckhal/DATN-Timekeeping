#pragma once

#include <Arduino.h>

#include "drivers/BuzzerDriver.h"
#include "drivers/RfidDriver.h"
#include "models/DeviceConfig.h"
#include "services/DisplayService.h"
#include "services/NetworkService.h"

namespace tk::services {
class RfidService {
 public:
  RfidService(drivers::RfidDriver& rfid,
              DisplayService& display,
              NetworkService& network,
              drivers::BuzzerDriver& buzzer);

  void begin();
  void tick(const models::DeviceConfig& config,
            const String& apiKey,
            bool allowed);
  bool isBusy() const;

 private:
  enum class State : uint8_t {
    IDLE,
    SHOWING_RESULT,
    WAIT_CARD_RELEASE,
  };

  String generateClientTxId(const String& uid) const;
  void parseAndApply(const String& body);
  void enterResultState();

  drivers::RfidDriver& rfid_;
  DisplayService& display_;
  NetworkService& network_;
  drivers::BuzzerDriver& buzzer_;

  State state_;
  uint32_t resultShownAtMs_;
};
}  // namespace tk::services
