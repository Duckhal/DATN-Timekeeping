#pragma once

#include <Adafruit_Fingerprint.h>
#include <Arduino.h>

namespace tk::drivers {
class FingerprintDriver {
 public:
  FingerprintDriver(HardwareSerial& serialPort, uint8_t rxPin, uint8_t txPin, uint32_t baudRate);

  void begin();
  bool verifyPassword();

  uint8_t getImage();
  uint8_t image2Tz(uint8_t slot);
  uint8_t createModel();
  uint16_t storeModel(uint16_t id);
  uint16_t loadModel(uint16_t id);
  uint16_t deleteModel(uint16_t id);

  /** Returns the first slot id in [1, maxId] not used by a stored template, or 0 if none. */
  uint16_t findFirstFreeSlot(uint16_t maxId);

  enum class MatchResult : uint8_t {
    NO_FINGER,   // Sensor has no finger placed — caller should poll again silently.
    NO_MATCH,    // A finger was captured but did not match any stored template.
    MATCHED,     // Match found; outId/outConfidence are written.
  };

  /**
   * Non-blocking capture + 1:N match. Distinguishes between "no finger at all"
   * (polling state) and "finger present but unknown" (user feedback needed).
   */
  MatchResult tryMatchFinger(uint16_t& outId, uint16_t& outConfidence);

  String getTemplateAsHex(uint16_t id);

  bool setTemplateFromHex(uint16_t id, const String& hexData);

 private:
  HardwareSerial& serialPort_;
  uint8_t rxPin_;
  uint8_t txPin_;
  uint32_t baudRate_;
  Adafruit_Fingerprint fingerprint_;
};
}  // namespace tk::drivers
