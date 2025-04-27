# Enhanced Active Effects

A small module for applying lighting and vision effects to tokens through Active Effects in Foundry VTT.

## Description

Enhanced Active Effects (EAE) allows you to manipulate token lighting, vision, and appearance through the Active Effects system in Foundry VTT. This module makes it easy to create dynamic lighting effects that automatically apply when conditions, items, or spells are active on a character.

## Features

- Apply changes to token lighting (brightness, color, animation)
- Modify token vision properties (range, modes)
- Change detection modes for tokens
- Support for temporary size adjustments
- Works with both linked and unlinked tokens
- Compatible with items that grant lighting effects

## Installation

1. In the Foundry VTT setup screen, navigate to the "Add-on Modules" tab
2. Click "Install Module"
3. Search for "Enhanced Active Effects" or paste the following manifest URL:
   ```
   https://raw.githubusercontent.com/Conjectural-Technologies/enhanced-active-effects/main/module.json
   ```
4. Click "Install"

## Usage

### Creating Effects

Enhanced Active Effects uses the standard Active Effect system in Foundry VTT. When creating an effect, prefix any token property with `EAE.` to have it affect the token.

#### Available Properties:

- `EAE.light.bright` - Bright light radius
- `EAE.light.dim` - Dim light radius
- `EAE.light.color` - Light color
- `EAE.light.alpha` - Light intensity
- `EAE.light.animation` - Light animation (JSON format)
- `EAE.light.angle` - Light angle
- `EAE.light.gradual` - Gradual light (boolean)
- `EAE.sight.visionMode` - Vision mode
- `EAE.brightSight` - Bright sight radius
- `EAE.dimSight` - Dim sight radius
- `EAE.detectionModes.[id].range` - Detection mode range
- `EAE.detectionModes.[id].enabled` - Detection mode enabled (boolean)
- `EAE.alpha` - Token opacity
- `EAE.scale` - Token scale
- `EAE.width` - Token width
- `EAE.height` - Token height
- `EAE.rotation` - Token rotation
- `EAE.mirrorX` - Horizontal mirroring (boolean)
- `EAE.mirrorY` - Vertical mirroring (boolean)

### Example Effect

Creating a torch effect on an item:

1. Create a new item or edit an existing one
2. Add an Active Effect
3. Add the following changes:
   - `EAE.light.bright` = 20 (OVERRIDE)
   - `EAE.light.dim` = 40 (OVERRIDE)
   - `EAE.light.color` = "#f8c377" (OVERRIDE)
   - `EAE.light.animation` = `{"type": "torch", "speed": 1, "intensity": 1}` (OVERRIDE)

## Compatibility

- Requires Foundry VTT v12.331 or higher
- Verified compatible with Foundry VTT v13
- Designed for D&D 5e system

## Support

For issues or feature requests, please visit the [GitHub repository](https://github.com/Conjectural-Technologies/enhanced-active-effects).

## License

This module is licensed under the [MIT License](./LICENSE).

## Credits

Original development by Conjectural Technologies.