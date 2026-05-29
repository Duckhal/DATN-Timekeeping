#include "services/DisplayService.h"

namespace tk::services {
DisplayService::DisplayService()
    : display_(config::gpio::kTftCs,
               config::gpio::kTftDc,
               config::gpio::kTftRst,
               config::gpio::kTftMosi,
               config::gpio::kTftSclk) {}

void DisplayService::begin() {
  display_.begin(240, 320);
}

void DisplayService::showNotConnected(const String& apSsid, const String& portalIp) {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Device not connected.", 20, ST77XX_WHITE, 2);
  display_.drawCenteredText("Connect to:", 60, ST77XX_WHITE, 2);
  display_.drawCenteredText(apSsid, 84, ST77XX_WHITE, 2);
  display_.drawCenteredText("Go to:", 124, ST77XX_WHITE, 2);
  display_.drawCenteredText(portalIp, 148, ST77XX_WHITE, 2);
}

void DisplayService::showServerConnectionFailed(int httpStatusCode) {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Server connection", 26, ST77XX_RED, 2);
  display_.drawCenteredText("failed.", 50, ST77XX_RED, 2);
  if (httpStatusCode > 0) {
    display_.drawCenteredText(String("HTTP error: ") + httpStatusCode, 80, ST77XX_WHITE, 1);
  } else {
    display_.drawCenteredText("HTTP error: timeout/no response", 80, ST77XX_WHITE, 1);
  }
  display_.drawCenteredText("Please press BOOT", 96, ST77XX_WHITE, 1);
  display_.drawCenteredText("button once to retry.", 112, ST77XX_WHITE, 1);
}

void DisplayService::showConnectedSuccessfully() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Connected", 90, ST77XX_GREEN, 3);
  display_.drawCenteredText("Successfully", 124, ST77XX_GREEN, 3);
}

void DisplayService::showInactiveMode() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Status:", 90, ST77XX_WHITE, 2);
  display_.drawCenteredText("INACTIVE", 120, ST77XX_RED, 3);
}

void DisplayService::showMaintenanceMode() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("MAINTENANCE", 90, ST77XX_YELLOW, 3);
  display_.drawCenteredText("MODE", 126, ST77XX_YELLOW, 3);
}

void DisplayService::showNotifyingServer() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Notifying Server...", 106, ST77XX_YELLOW, 2);
}

void DisplayService::showDeviceDeletedFactoryResetting() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Device Deleted", 86, ST77XX_RED, 2);
  display_.drawCenteredText("Factory Resetting...", 118, ST77XX_RED, 2);
}

void DisplayService::showEnrollModePlaceFinger() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("ENROLL MODE", 70, ST77XX_CYAN, 3);
  display_.drawCenteredText("Place finger...", 120, ST77XX_WHITE, 2);
}

void DisplayService::showEnrollModeRemoveFinger() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("ENROLL MODE", 70, ST77XX_CYAN, 3);
  display_.drawCenteredText("Remove finger...", 120, ST77XX_WHITE, 2);
}

void DisplayService::showEnrollModePlaceSameFinger() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("ENROLL MODE", 62, ST77XX_CYAN, 3);
  display_.drawCenteredText("Place same", 108, ST77XX_WHITE, 2);
  display_.drawCenteredText("finger again...", 136, ST77XX_WHITE, 2);
}

void DisplayService::showEnrollSuccess(uint16_t id) {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Scan Success!", 88, ST77XX_GREEN, 2);
  display_.drawCenteredText(String("ID: ") + id, 124, ST77XX_GREEN, 2);
}

void DisplayService::showEnrollFailed() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Enroll Failed!", 106, ST77XX_RED, 2);
}

void DisplayService::showWelcome() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Welcome", 95, ST77XX_WHITE, 4);
}

void DisplayService::showSettingsCleared() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Settings Cleared!", 85, ST77XX_RED, 2);
  display_.drawCenteredText("Rebooting...", 120, ST77XX_RED, 2);
}

void DisplayService::showCheckinSuccess(const String& employeeName) {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Have a good day,", 96, ST77XX_GREEN, 2);
  display_.drawCenteredText(employeeName, 130, ST77XX_GREEN, 2);
}

void DisplayService::showCheckinDenied() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Check-in failed", 96, ST77XX_RED, 2);
  display_.drawCenteredText("Please try again", 130, ST77XX_WHITE, 2);
}

void DisplayService::showAlreadyCheckedIn(const String& employeeName) {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Already checked in", 86, ST77XX_YELLOW, 2);
  if (employeeName.length() > 0) {
    display_.drawCenteredText(employeeName, 124, ST77XX_YELLOW, 2);
  }
}

void DisplayService::showCardNotRecognized() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Card not recognized", 96, ST77XX_RED, 2);
  display_.drawCenteredText("Please try again", 130, ST77XX_WHITE, 2);
}

void DisplayService::showBulkSyncProgress(uint16_t count) {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Syncing templates...", 80, ST77XX_YELLOW, 2);
  display_.drawCenteredText(String(count) + " synced", 120, ST77XX_WHITE, 2);
}

void DisplayService::showBulkSyncComplete(uint16_t count) {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Sync complete!", 80, ST77XX_GREEN, 2);
  display_.drawCenteredText(String(count) + " templates", 120, ST77XX_WHITE, 2);
}

void DisplayService::showBulkSyncFailed() {
  display_.clear(ST77XX_BLACK);
  display_.drawCenteredText("Sync failed", 90, ST77XX_RED, 2);
  display_.drawCenteredText("Please retry", 120, ST77XX_WHITE, 2);
}
}  // namespace tk::services
