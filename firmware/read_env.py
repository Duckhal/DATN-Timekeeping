import os

try:
    from SCons.Script import DefaultEnvironment
    env = DefaultEnvironment()
except ImportError:
    # Back up if SCons is not available (e.g., when running outside of PlatformIO)
    env = None

if env:
    # Read .env file from the project root directory
    project_dir = env.get("PROJECT_DIR", "")
    env_file = os.path.join(project_dir, ".env")

    if os.path.exists(env_file):
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                # Ignore empty lines and comments
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    # CLean up key and value
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    
                    # Define the macro for the build flags, escaping quotes for string values
                    env.Append(BUILD_FLAGS=[f'-D{key}=\"\\\"{value}\\\"\"'])
    else:
        print(f"Warning: .env file not found at {env_file}")
else:
    print("Warning: Could not resolve SCons DefaultEnvironment")