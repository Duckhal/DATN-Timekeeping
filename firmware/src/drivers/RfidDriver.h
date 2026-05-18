#pragma once

#include <Arduino.h>
#include <SPI.h>

#include <MFRC522DriverPinSimple.h>
#include <MFRC522DriverSPI.h>
#include <MFRC522v2.h>

namespace tk::drivers {

/**
 * RC522 driver wired through ESP32 HSPI bus, isolated from the VSPI bus that
 * the TFT and (optionally) other peripherals use.
 *
 * The MFRC522v2 library splits the chip from the bus driver, so we can hand it
 * a dedicated SPIClass and avoid contention with shared VSPI traffic.
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

  SPIClass hspi_;
  MFRC522DriverPinSimple ssPin_;
  MFRC522DriverSPI spiDriver_;
  MFRC522 rfid_;
};

}  // namespace tk::drivers
