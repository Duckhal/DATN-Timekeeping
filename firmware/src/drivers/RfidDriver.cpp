#include "drivers/RfidDriver.h"

namespace tk::drivers {

RfidDriver::RfidDriver(uint8_t sck, uint8_t miso, uint8_t mosi, uint8_t ss, uint8_t rst)
    : sck_(sck),
      miso_(miso),
      mosi_(mosi),
      ss_(ss),
      rst_(rst),
      hspi_(HSPI),
      ssPin_(ss),
      spiDriver_(ssPin_, hspi_, SPISettings(4000000, MSBFIRST, SPI_MODE0)),
      rfid_(spiDriver_) {}

void RfidDriver::begin() {
  // Bring up our own HSPI bus so it never collides with the VSPI bus the TFT
  // is currently driving.
  hspi_.begin(sck_, miso_, mosi_, ss_);

  // Hard reset the chip via the RST line so it starts from a known state.
  pinMode(rst_, OUTPUT);
  digitalWrite(rst_, LOW);
  delay(10);
  digitalWrite(rst_, HIGH);
  delay(50);

  rfid_.PCD_Init();
  delay(20);

  // Read VersionReg (0x37) to confirm the chip is talking to us.
  const byte version = rfid_.PCD_GetVersion();
  Serial.printf("[RFID] RC522 firmware=0x%02X\n", version);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("[RFID] RC522 not detected. Check power and wiring.");
  }
}

bool RfidDriver::readUidHex(String& outUid) {
  if (!rfid_.PICC_IsNewCardPresent()) {
    return false;
  }

  if (!rfid_.PICC_ReadCardSerial()) {
    Serial.println("[RFID] Card present but failed to read UID.");
    return false;
  }

  Serial.print("[RFID] UID raw:");
  for (byte i = 0; i < rfid_.uid.size; i++) {
    const byte value = rfid_.uid.uidByte[i];
    Serial.print(" ");
    if (value < 0x10) {
      Serial.print("0");
    }
    Serial.print(value, HEX);
  }
  Serial.println();

  outUid = formatUidHex();
  rfid_.PICC_HaltA();
  return true;
}

String RfidDriver::formatUidHex() const {
  String uid;
  uid.reserve(rfid_.uid.size * 2);

  for (byte i = 0; i < rfid_.uid.size; i++) {
    const byte value = rfid_.uid.uidByte[i];
    if (value < 0x10) {
      uid += "0";
    }
    uid += String(value, HEX);
  }

  uid.toUpperCase();
  return uid;
}

bool RfidDriver::isCardPresent() {
  // PICC_IsNewCardPresent only returns true once per fresh card placement.
  // Use it as a coarse "is anything on the antenna right now" signal for
  // the wait-release state.
  return rfid_.PICC_IsNewCardPresent();
}

}  // namespace tk::drivers
