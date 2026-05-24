#include "drivers/RfidDriver.h"

namespace tk::drivers {

RfidDriver::RfidDriver(uint8_t sck, uint8_t miso, uint8_t mosi, uint8_t ss, uint8_t rst)
    : sck_(sck),
      miso_(miso),
      mosi_(mosi),
      ss_(ss),
      rst_(rst),
      rfid_(ss, rst) {}

void RfidDriver::begin() {
  SPI.begin(sck_, miso_, mosi_, ss_);
  rfid_.PCD_Init();
  delay(20);

  const byte version = rfid_.PCD_ReadRegister(rfid_.VersionReg);
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
  return rfid_.PICC_IsNewCardPresent();
}

}  // namespace tk::drivers
