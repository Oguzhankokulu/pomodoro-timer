# 🍅 Pomodoro Timer

A sleek GNOME Shell extension for productivity using the Pomodoro Technique.

![GNOME](https://img.shields.io/badge/GNOME-45--49-blue?logo=gnome)
![License](https://img.shields.io/badge/License-GPL--3.0-green)

## Features

- **Timer Controls** - Start, Pause, Skip, Reset from the panel dropdown
- **Sound Notifications** - Audio alerts for timer events
- **Suspend Inhibitor** - Keeps your system awake during pomodoros (Caffeine Like)
- **Adjustable Durations** - Work, Short Break, Long Break, Intervals per Set
- **Minimal UI** - Timer hidden when idle, shown only when running

## Screenshots

| Dropdown Menu | Timer Settings |
|:-------------:|:--------------:|
| ![Dropdown](assets/Screenshots/dropdown.png) | ![Timer](assets/Screenshots/timer_configs.png) |

| Appearance Settings | Behavior Settings |
|:-------------------:|:-----------------:|
| ![Appearance](assets/Screenshots/appearance_configs.png) | ![Behavior](assets/Screenshots/behavior_configs.png) |

## Settings

Open preferences via:
```bash
gnome-extensions prefs pomodoro-timer@Oguzhankokulu.github.com
```

| Setting | Description |
|---------|-------------|
| Auto-start Breaks | Automatically start break after work |
| Auto-start Work | Automatically start work after break |
| Always Show Timer | Show timer in panel even when idle |
| Enable Sounds | Play audio notifications |
| Tick Sound | Play ticking sound while running |
| Prevent Auto-suspend | Keep system awake during pomodoro |

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/Oguzhankokulu/gnome-pomodoro-extension.git

# Copy to extensions directory
cp -r pomodoro-timer@Oguzhankokulu.github.com ~/.local/share/gnome-shell/extensions/

# Compile schemas
glib-compile-schemas ~/.local/share/gnome-shell/extensions/pomodoro-timer@Oguzhankokulu.github.com/schemas/

# Enable extension (logout/login required on Wayland)
gnome-extensions enable pomodoro-timer@Oguzhankokulu.github.com
```

## Customization

### Custom Icon

Replace the panel icon by swapping `assets/images/fruit.png` with your own **16×16 pixel** PNG image. Keep the filename as `fruit.png`.

### Custom Sounds

Replace sound files in `assets/sounds/`:
- `start.ogg` - Plays when timer starts
- `tick.ogg` - Plays every second (if enabled)
- `complete.ogg` - Plays when interval completes

## Requirements

- GNOME Shell 45, 46, 47, 48, or 49
- `paplay` (PulseAudio) for sound playback

## License

GPL-3.0
