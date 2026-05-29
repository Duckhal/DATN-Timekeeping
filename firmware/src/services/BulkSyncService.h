#pragma once

#include <Arduino.h>

#include "drivers/FingerprintDriver.h"
#include "models/DeviceConfig.h"
#include "services/DisplayService.h"
#include "services/NetworkService.h"

namespace tk::services {
class BulkSyncService {
 public:
  BulkSyncService(drivers::FingerprintDriver& fingerprint,
                  NetworkService& network,
                  DisplayService& display);

  void startSync();
  void tick(const models::DeviceConfig& config, const String& apiKey);
  bool isSyncing() const;

 private:
  enum class State : uint8_t {
    IDLE,
    FETCHING,
    PAGE_DELAY,
    DONE,
    FAILED,
  };

  struct MappingEntry {
    uint32_t employeeId;
    uint16_t fingerprintSlot;
  };

  static constexpr uint8_t kMaxEntriesPerPage = 5;

  drivers::FingerprintDriver& fingerprint_;
  NetworkService& network_;
  DisplayService& display_;

  State state_;
  uint32_t pageDelayStartMs_;
  uint8_t retryCount_;
  uint16_t totalSynced_;

  MappingEntry pending_[kMaxEntriesPerPage];
  uint8_t pendingCount_;

  bool processPage(const String& body);
  bool sendAck(const models::DeviceConfig& config, const String& apiKey);
  String buildMappingsJson() const;
};
}  // namespace tk::services
