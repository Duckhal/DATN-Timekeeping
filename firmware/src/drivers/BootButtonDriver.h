#pragma once

#include <Arduino.h>

namespace tk::drivers {
class BootButtonDriver {
 public:
  struct Event {
    bool shortPress;
    bool longPress;
  };

  BootButtonDriver(uint8_t pin, uint32_t debounceMs, uint32_t shortPressMinMs,
                   uint32_t longPressMs);

  void begin();
  Event update();

 private:
  uint8_t pin_;
  uint32_t debounceMs_;
  uint32_t shortPressMinMs_;
  uint32_t longPressMs_;

  bool rawPressed_;
  bool stablePressed_;
  bool longPressHandled_;
  uint32_t pressedAtMs_;
  uint32_t lastBounceMs_;
};
}  // namespace tk::drivers
