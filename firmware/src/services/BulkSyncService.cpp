#include "services/BulkSyncService.h"

#include <ArduinoJson.h>

#include "Config/Config.h"

namespace tk::services {
BulkSyncService::BulkSyncService(drivers::FingerprintDriver& fingerprint,
                                 NetworkService& network,
                                 DisplayService& display)
    : fingerprint_(fingerprint),
      network_(network),
      display_(display),
      state_(State::IDLE),
      pageDelayStartMs_(0),
      retryCount_(0),
      totalSynced_(0),
      pendingCount_(0) {}

void BulkSyncService::startSync() {
  if (state_ == State::FETCHING || state_ == State::PAGE_DELAY) {
    Serial.println("[BulkSync] Already syncing, ignoring duplicate command.");
    return;
  }

  state_ = State::FETCHING;
  retryCount_ = 0;
  totalSynced_ = 0;
  pendingCount_ = 0;
  display_.showBulkSyncProgress(0);
  Serial.println("[BulkSync] Started.");
}

bool BulkSyncService::isSyncing() const {
  return state_ == State::FETCHING || state_ == State::PAGE_DELAY;
}

void BulkSyncService::tick(const models::DeviceConfig& config,
                           const String& apiKey) {
  if (state_ == State::IDLE || state_ == State::DONE ||
      state_ == State::FAILED) {
    return;
  }

  if (state_ == State::PAGE_DELAY) {
    if (millis() - pageDelayStartMs_ >= config::timing::kBulkSyncPageDelayMs) {
      state_ = State::FETCHING;
    }
    return;
  }

  // State::FETCHING
  String body;
  const bool fetchOk = network_.fetchBulkSyncPage(config, apiKey, body);

  if (!fetchOk) {
    retryCount_++;
    Serial.printf("[BulkSync] Fetch failed. Retry %u/%u\n",
                  retryCount_, config::timing::kBulkSyncMaxRetries);
    if (retryCount_ >= config::timing::kBulkSyncMaxRetries) {
      state_ = State::FAILED;
      display_.showBulkSyncFailed();
      Serial.println("[BulkSync] FAILED after max retries.");
    }
    return;
  }

  retryCount_ = 0;
  const bool hasMore = processPage(body);

  if (pendingCount_ == 0 && !hasMore) {
    state_ = State::DONE;
    display_.showBulkSyncComplete(totalSynced_);
    Serial.printf("[BulkSync] DONE. Total synced: %u\n", totalSynced_);
    return;
  }

  if (pendingCount_ > 0) {
    const bool ackOk = sendAck(config, apiKey);
    if (!ackOk) {
      retryCount_++;
      Serial.printf("[BulkSync] ACK failed. Retry %u/%u\n",
                    retryCount_, config::timing::kBulkSyncMaxRetries);
      if (retryCount_ >= config::timing::kBulkSyncMaxRetries) {
        state_ = State::FAILED;
        display_.showBulkSyncFailed();
      }
      return;
    }

    totalSynced_ += pendingCount_;
    pendingCount_ = 0;
    retryCount_ = 0;
    display_.showBulkSyncProgress(totalSynced_);
  }

  if (hasMore) {
    pageDelayStartMs_ = millis();
    state_ = State::PAGE_DELAY;
  } else {
    state_ = State::DONE;
    display_.showBulkSyncComplete(totalSynced_);
    Serial.printf("[BulkSync] DONE. Total synced: %u\n", totalSynced_);
  }
}

bool BulkSyncService::processPage(const String& body) {
  pendingCount_ = 0;

  DynamicJsonDocument doc(8192);
  const DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[BulkSync] JSON parse error: %s\n", err.c_str());
    return false;
  }

  const bool hasMore = doc["has_more"] | false;
  JsonArray items = doc["items"].as<JsonArray>();

  for (JsonObject item : items) {
    if (pendingCount_ >= kMaxEntriesPerPage) break;

    const uint32_t employeeId = item["employee_id"] | 0;
    const String templateData = item["template_data"] | "";

    if (employeeId == 0 || templateData.length() == 0) {
      Serial.println("[BulkSync] Skipping item with missing data.");
      continue;
    }

    const uint16_t freeSlot =
        fingerprint_.findFirstFreeSlot(config::fingerprint::kMaxTemplateId);

    if (freeSlot == 0) {
      Serial.println("[BulkSync] No free slot available. Skipping remaining.");
      break;
    }

    const bool stored = fingerprint_.setTemplateFromHex(freeSlot, templateData);
    if (!stored) {
      Serial.printf("[BulkSync] Failed to store template at slot %u. Skipping.\n",
                    freeSlot);
      continue;
    }

    pending_[pendingCount_].employeeId = employeeId;
    pending_[pendingCount_].fingerprintSlot = freeSlot;
    pendingCount_++;

    Serial.printf("[BulkSync] Stored emp=%lu slot=%u\n",
                  (unsigned long)employeeId, freeSlot);
  }

  return hasMore;
}

bool BulkSyncService::sendAck(const models::DeviceConfig& config,
                              const String& apiKey) {
  const String json = buildMappingsJson();
  return network_.sendBulkSyncAck(config, apiKey, json);
}

String BulkSyncService::buildMappingsJson() const {
  String json = "[";
  for (uint8_t i = 0; i < pendingCount_; i++) {
    if (i > 0) json += ",";
    json += "{\"employee_id\":";
    json += String(pending_[i].employeeId);
    json += ",\"fingerprint_id\":";
    json += String(pending_[i].fingerprintSlot);
    json += "}";
  }
  json += "]";
  return json;
}
}  // namespace tk::services
