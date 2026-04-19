#include "drivers/BootButtonDriver.h"

namespace tk::drivers {
BootButtonDriver::BootButtonDriver(uint8_t pin, uint32_t debounceMs,
                                   uint32_t shortPressMinMs,
                                   uint32_t longPressMs)
    : pin_(pin),
      debounceMs_(debounceMs),
      shortPressMinMs_(shortPressMinMs),
      longPressMs_(longPressMs),
      rawPressed_(false),
      stablePressed_(false),
      longPressHandled_(false),
      pressedAtMs_(0),
      lastBounceMs_(0) {}

void BootButtonDriver::begin() {
  pinMode(pin_, INPUT_PULLUP);
}

BootButtonDriver::Event BootButtonDriver::update() {
  Event event{false, false};

  const bool rawPressedNow = digitalRead(pin_) == LOW;
  if (rawPressedNow != rawPressed_) {
    rawPressed_ = rawPressedNow;
    lastBounceMs_ = millis();
  }

  if (millis() - lastBounceMs_ < debounceMs_) {
    return event;
  }

  if (stablePressed_ != rawPressed_) {
    stablePressed_ = rawPressed_;

    if (stablePressed_) {
      pressedAtMs_ = millis();
      longPressHandled_ = false;
    } else {
      const uint32_t heldMs = millis() - pressedAtMs_;
      if (!longPressHandled_ && heldMs >= shortPressMinMs_ && heldMs < longPressMs_) {
        event.shortPress = true;
      }
    }
  }

  if (stablePressed_ && !longPressHandled_ && millis() - pressedAtMs_ >= longPressMs_) {
    longPressHandled_ = true;
    event.longPress = true;
  }

  return event;
}
}  // namespace tk::drivers
