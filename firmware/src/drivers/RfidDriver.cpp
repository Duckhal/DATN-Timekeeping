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
  rfid_.PCD_StopCrypto1();
  return true;
}

bool RfidDriver::isCardPresent() {
  return rfid_.PICC_IsNewCardPresent();
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
}  // namespace tk::drivers
