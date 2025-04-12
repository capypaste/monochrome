# Monochrome

A Chrome extension that toggles webpage colors between grayscale and original with a single click.

## Features

- Toggle between grayscale and normal colors with a single click
- State is remembered per tab
- Apply grayscale to all tabs at once with a single setting
- Works on all websites
- Visual feedback through the extension icon

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension directory

## Usage

### Basic Usage

- Click the extension icon in the Chrome toolbar to toggle grayscale mode for the current tab
- Use the keyboard shortcut `Alt+G` to quickly toggle grayscale (without opening the popup)
- The extension icon will change to indicate when grayscale is active

### Apply To All Tabs

1. Click the extension icon to open the settings popup
2. Check the "Apply to all tabs" checkbox
3. When enabled, toggling grayscale on one tab will apply it to all open tabs
4. This setting persists between browser sessions

## Development

To build the extension from source:

```
npm install
npx tsc
```
