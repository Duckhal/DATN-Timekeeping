#pragma once

#include <Arduino.h>

#include "drivers/FingerprintDriver.h"
#include "models/DeviceConfig.h"
#include "services/NetworkService.h"

namespace tk::services {

/**
 * Owns the retry queue for SYNC_FINGERPRINT mapping callbacks.
 *
 * When a device stores a synced template in a free slot, it must tell the
 * backend so the Mapping(device, employee, fingerprint_id) row is written.
 * If the HTTP callback fails (e.g. wifi blip), we retry a bounded number of
 * times; if all attempts fail, we roll back by deleting the local template
 * so the sensor never ends up out of sync with the backend.
 */
class SyncMappingService {
 public:
  SyncMappingService(drivers::FingerprintDriver& fingerprint,
                     NetworkService& network);

  /** Enqueue a pending mapping. Returns false if the queue is already full. */
  bool enqueue(uint8_t employeeId, uint8_t fingerprintSlot);

  /** Called from App::tick() — processes at most one pending entry per tick. */
  void tick(const models::DeviceConfig& config,
            const String& apiKey,
            uint32_t retryIntervalMs,
            uint8_t maxAttempts);

 private:
  static constexpr uint8_t kMaxPending = 4;

  struct Pending {
    bool inUse;
    uint8_t employeeId;
    uint8_t fingerprintSlot;
    uint8_t attempts;
    uint32_t nextAttemptAtMs;
  };

  drivers::FingerprintDriver& fingerprint_;
  NetworkService& network_;
  Pending pending_[kMaxPending];
};

}  // namespace tk::services
