#pragma once

#include <Arduino.h>
#include <Preferences.h>

namespace tk::drivers {
class PreferencesDriver {
 public:
  bool begin(const char* ns, bool readOnly = false);
  String getString(const char* key, const String& defaultValue = "") const;
  uint16_t getUShort(const char* key, uint16_t defaultValue = 0) const;

  bool putString(const char* key, const String& value);
  bool putUShort(const char* key, uint16_t value);

  bool clear();

 private:
  mutable Preferences preferences_;
};
}  // namespace tk::drivers
