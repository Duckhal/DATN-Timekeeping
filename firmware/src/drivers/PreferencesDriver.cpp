#include "drivers/PreferencesDriver.h"

namespace tk::drivers {
bool PreferencesDriver::begin(const char* ns, bool readOnly) {
  return preferences_.begin(ns, readOnly);
}

String PreferencesDriver::getString(const char* key, const String& defaultValue) const {
  return preferences_.getString(key, defaultValue);
}

uint16_t PreferencesDriver::getUShort(const char* key, uint16_t defaultValue) const {
  return static_cast<uint16_t>(preferences_.getUShort(key, defaultValue));
}

bool PreferencesDriver::putString(const char* key, const String& value) {
  return preferences_.putString(key, value) == value.length();
}

bool PreferencesDriver::putUShort(const char* key, uint16_t value) {
  return preferences_.putUShort(key, value) > 0;
}

bool PreferencesDriver::clear() {
  return preferences_.clear();
}
}  // namespace tk::drivers
