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
  uint8_t storeModel(uint8_t id);
  uint8_t loadModel(uint8_t id);
  uint8_t deleteModel(uint8_t id);

  /** Returns the first slot id in [1, maxId] not used by a stored template, or 0 if none. */
  uint8_t findFirstFreeSlot(uint8_t maxId);

  String getTemplateAsHex(uint8_t id);

  bool setTemplateFromHex(uint8_t id, const String& hexData);

 private:
  HardwareSerial& serialPort_;
  uint8_t rxPin_;
  uint8_t txPin_;
  uint32_t baudRate_;
  Adafruit_Fingerprint fingerprint_;
};
}  // namespace tk::drivers
