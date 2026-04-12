#include "DisplayManager.h"

void DisplayManager::begin() {
  SPI.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft_.init(240, 320);
  tft_.setRotation(1);
  clearScreen();
}

void DisplayManager::clearScreen(uint16_t color) {
  tft_.fillScreen(color);
}

void DisplayManager::drawCenteredText(const String &text, int16_t y, uint16_t color, uint8_t textSize) {
  int16_t x1, y1;
  uint16_t w, h;

  tft_.setTextSize(textSize);
  tft_.setTextColor(color);
  tft_.getTextBounds(text, 0, y, &x1, &y1, &w, &h);

  const int16_t centerX = (tft_.width() - static_cast<int16_t>(w)) / 2;
  tft_.setCursor(centerX, y);
  tft_.print(text);
}

void DisplayManager::showNotConnected(const String &apSsid, const String &portalIp) {
  clearScreen(ST77XX_BLACK);
  tft_.setTextSize(2);
  tft_.setTextColor(ST77XX_WHITE);
  tft_.setCursor(8, 20);
  tft_.println("Device not connected.");
  tft_.setCursor(8, 60);
  tft_.println("Connect to:");
  tft_.setCursor(8, 84);
  tft_.println(apSsid);
  tft_.setCursor(8, 124);
  tft_.println("Go to:");
  tft_.setCursor(8, 148);
  tft_.println(portalIp);
}

void DisplayManager::showServerConnectionFailed(int httpStatusCode) {
  clearScreen(ST77XX_BLACK);
  tft_.setTextSize(2);
  tft_.setTextColor(ST77XX_RED);
  tft_.setCursor(8, 26);
  tft_.println("Server connection");
  tft_.setCursor(8, 50);
  tft_.println("failed.");

  tft_.setTextColor(ST77XX_WHITE);
  tft_.setTextSize(1);
  tft_.setCursor(8, 80);
  if (httpStatusCode > 0) {
    tft_.printf("HTTP error: %d\n", httpStatusCode);
  } else {
    tft_.println("HTTP error: timeout/no response");
  }
  tft_.setCursor(8, 96);
  tft_.println("Please press BOOT");
  tft_.setCursor(8, 112);
  tft_.println("button once to retry.");
}

void DisplayManager::showConnectedSuccessfully() {
  clearScreen(ST77XX_BLACK);
  drawCenteredText("Connected", 90, ST77XX_GREEN, 3);
  drawCenteredText("Successfully", 124, ST77XX_GREEN, 3);
}

void DisplayManager::showWelcome() {
  clearScreen(ST77XX_BLACK);
  drawCenteredText("Welcome", 95, ST77XX_WHITE, 4);
}

void DisplayManager::showSettingsCleared() {
  clearScreen(ST77XX_BLACK);
  drawCenteredText("Settings Cleared!", 85, ST77XX_RED, 2);
  drawCenteredText("Rebooting...", 120, ST77XX_RED, 2);
}
