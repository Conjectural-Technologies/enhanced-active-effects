# Enhanced Active Effects

A Foundry VTT module that extends the Active Effects system to control token lighting and vision effects.

## Overview

Enhanced Active Effects integrates with Foundry VTT's existing Active Effects system to allow dynamic control of token lighting and vision properties. This enables game masters and players to apply visual effects to tokens through the familiar Active Effects interface, triggered by items, abilities, or status effects.

## Features

- Apply lighting effects (color, brightness, animation) via Active Effects
- Modify token vision properties (vision modes, detection types)
- Seamless integration with the existing Active Effects system
- Automatic application when tokens are created or updated
- Support for both actor-linked and unlinked tokens
- System-agnostic design works with any game system

## How It Works

The module monitors Active Effects with keys that start with `enhanced.` and applies them to the token's properties. For example:

- `enhanced.light.color`: Changes the token's light color
- `enhanced.light.dim`: Modifies the dim light radius
- `enhanced.light.bright`: Adjusts the bright light radius
- `enhanced.light.animation`: Sets light animation properties
- `enhanced.sight.visionMode`: Changes the token's vision mode

## Technical Analysis

The module operates by:

1. Tracking Active Effects with keys prefixed by "enhanced."
2. Converting these effects into token property updates
3. Maintaining original token settings to restore them when effects end
4. Supporting multiple effect application modes (ADD, MULTIPLY, OVERRIDE, etc.)
5. Handling special cases like vision modes and detection methods

The code implements several Foundry hooks to ensure effects are applied:
- When effects are created, updated, or deleted
- When tokens are created or the canvas is ready
- When items are equipped or unequipped (using system-agnostic methods)

## Usage Examples

### Basic Light Effect

An Active Effect with the following changes:
- Key: `enhanced.light.dim` | Mode: Override | Value: `20`
- Key: `enhanced.light.bright` | Mode: Override | Value: `10`
- Key: `enhanced.light.color` | Mode: Override | Value: `#ff3300`

### Darkvision

An Active Effect with:
- Key: `enhanced.sight.visionMode` | Mode: Override | Value: `darkvision`

### Dancing Lights Animation

An Active Effect with:
- Key: `enhanced.light.animation` | Mode: Override | Value: `{"type": "torch", "speed": 5, "intensity": 5}`

## Compatibility

- Minimum Foundry VTT version: 12.331
- Verified on Foundry VTT version: 13
- Compatible with all Foundry VTT game systems

## License

This module is licensed under the MIT License. See the LICENSE file for details.

## Credits

Created by Conjectural Technologies