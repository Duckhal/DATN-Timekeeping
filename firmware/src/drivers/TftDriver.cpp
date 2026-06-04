#include "drivers/TftDriver.h"

namespace tk::drivers {
TftDriver::TftDriver(uint8_t csPin, uint8_t dcPin, uint8_t rstPin,
                     uint8_t mosiPin, uint8_t sclkPin)
    : csPin_(csPin),
      dcPin_(dcPin),
      rstPin_(rstPin),
      mosiPin_(mosiPin),
      sclkPin_(sclkPin),
      hspi_(HSPI),
      tft_(&hspi_, csPin, dcPin, rstPin) {}

void TftDriver::begin(uint16_t width, uint16_t height) {
  hspi_.begin(sclkPin_, -1, mosiPin_, csPin_);
  tft_.init(width, height);
  tft_.setRotation(1);
  tft_.invertDisplay(false);
  tft_.fillScreen(ST77XX_BLACK);
}

void TftDriver::clear(uint16_t color) {
  tft_.fillScreen(color);
}

void TftDriver::drawCenteredText(const String& text, int16_t y, uint16_t color,
                                 uint8_t textSize) {
  tft_.setTextSize(textSize);
  tft_.setTextColor(color);

  int16_t x1;
  int16_t y1;
  uint16_t w;
  uint16_t h;
  tft_.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);

  const int16_t x = static_cast<int16_t>((tft_.width() - w) / 2);
  tft_.setCursor(x, y);
  tft_.print(text);
}

void TftDriver::drawLeftAlignedLog(const String& text, int16_t y, uint16_t color, uint8_t textSize) {
  tft_.setTextSize(textSize);

   // Clear the line first
   int16_t x1, y1;
   uint16_t w, h;
   tft_.getTextBounds("A", 0, 0, &x1, &y1, &w, &h);
   tft_.fillRect(0, y, tft_.width(), h + 4, ST77XX_BLACK);

   // Draw the new text
   tft_.setTextColor(color);
   tft_.setCursor(15, y);
   tft_.print(text);
}
}  // namespace tk::drivers
