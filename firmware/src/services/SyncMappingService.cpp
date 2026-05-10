#include "services/SyncMappingService.h"

namespace tk::services {

SyncMappingService::SyncMappingService(drivers::FingerprintDriver& fingerprint,
                                       NetworkService& network)
    : fingerprint_(fingerprint), network_(network) {
  for (uint8_t i = 0; i < kMaxPending; i++) {
    pending_[i] = {false, 0, 0, 0, 0};
  }
}

bool SyncMappingService::enqueue(uint32_t employeeId, uint16_t fingerprintSlot) {
  for (uint8_t i = 0; i < kMaxPending; i++) {
    if (!pending_[i].inUse) {
      pending_[i] = {true, employeeId, fingerprintSlot, 0, millis()};
      Serial.printf("[SyncMapping] Enqueued employee=%lu slot=%u\n",
                    employeeId, fingerprintSlot);
      return true;
    }
  }

  Serial.println("[SyncMapping] Queue full, dropping entry.");
  return false;
}

void SyncMappingService::tick(const models::DeviceConfig& config,
                              const String& apiKey,
                              uint32_t retryIntervalMs,
                              uint8_t maxAttempts) {
  const uint32_t now = millis();

  for (uint8_t i = 0; i < kMaxPending; i++) {
    Pending& entry = pending_[i];
    if (!entry.inUse) {
      continue;
    }

    if ((int32_t)(now - entry.nextAttemptAtMs) < 0) {
      continue;
    }

    entry.attempts++;
    Serial.printf("[SyncMapping] Attempt %u/%u for employee=%lu slot=%u\n",
                  entry.attempts, maxAttempts, entry.employeeId, entry.fingerprintSlot);

    const bool ok = network_.registerSyncMappingCallback(
        config, apiKey, entry.employeeId, entry.fingerprintSlot);

    if (ok) {
      Serial.printf("[SyncMapping] Success for employee=%lu slot=%u\n",
                    entry.employeeId, entry.fingerprintSlot);
      entry.inUse = false;
      return;
    }

    if (entry.attempts >= maxAttempts) {
      Serial.printf("[SyncMapping] Exhausted retries for employee=%lu slot=%u — rolling back sensor.\n",
                    entry.employeeId, entry.fingerprintSlot);
      const uint8_t delResult = fingerprint_.deleteModel(entry.fingerprintSlot);
      Serial.printf("[SyncMapping] deleteModel(%u) -> %u\n",
                    entry.fingerprintSlot, delResult);
      entry.inUse = false;
      return;
    }

    entry.nextAttemptAtMs = now + retryIntervalMs;
    // Only drive one pending entry per tick to avoid hammering HTTP.
    return;
  }
}

}  // namespace tk::services
