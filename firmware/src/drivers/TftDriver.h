#pragma once

#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <Arduino.h>
#include <SPI.h>

namespace tk::drivers {
class TftDriver {
 public:
  TftDriver(uint8_t csPin, uint8_t dcPin, uint8_t rstPin, uint8_t mosiPin, uint8_t sclkPin);

  void begin(uint16_t width = 240, uint16_t height = 320);
  void clear(uint16_t color = ST77XX_BLACK);
  void invertDisplay(bool status);

  void drawCenteredText(const String& text, int16_t y, uint16_t color, uint8_t textSize);
  void drawLeftAlignedLog(const String& text, int16_t y, uint16_t color, uint8_t textSize = 2);

 private:
  uint8_t csPin_;
  uint8_t dcPin_;
  uint8_t rstPin_;
  uint8_t mosiPin_;
  uint8_t sclkPin_;
  SPIClass hspi_;
  Adafruit_ST7789 tft_;
};
}  // namespace tk::drivers
