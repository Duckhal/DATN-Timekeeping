#pragma once

#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>

namespace tk::drivers {

/**
 * RC522 driver sharing the global VSPI bus with the TFT display.
 * Uses MFRC522 v1 library (proven stable on this hardware).
 */
class RfidDriver {
 public:
  RfidDriver(uint8_t sck, uint8_t miso, uint8_t mosi, uint8_t ss, uint8_t rst);

  void begin();
  bool readUidHex(String& outUid);
  bool isCardPresent();

 private:
  String formatUidHex() const;

  uint8_t sck_;
  uint8_t miso_;
  uint8_t mosi_;
  uint8_t ss_;
  uint8_t rst_;

  MFRC522 rfid_;
};

}  // namespace tk::drivers
