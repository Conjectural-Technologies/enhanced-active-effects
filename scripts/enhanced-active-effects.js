const { deepClone, flattenObject, getProperty, hasProperty, mergeObject, setProperty, getType } = foundry.utils;

class enhanced {
    static async ready() {
        const getEffects = (actor) => {
            if (!actor) return [];
            return actor.appliedEffects.filter(e => e.changes.some(c => c.key.startsWith("enhanced.")));
        };

        const getActorFromEffect = (effect) => {
            if (effect.parent instanceof Actor) return effect.parent;
            if (effect.parent?.parent instanceof Actor) return effect.parent.parent;
            return null;
        };

        // 1. CONSOLIDATED HOOK LOGIC
        const handleEffectUpdate = (effect, userId) => {
            if (game.userId !== userId || effect.disabled || effect.isSuppressed) return;
            if (!effect.changes?.some(c => c.key.startsWith("enhanced."))) return;
            
            const actor = getActorFromEffect(effect);
            if (actor) enhanced.applyEffects(actor, getEffects(actor));
        };

        Hooks.on("createActiveEffect", (effect, options, userId) => handleEffectUpdate(effect, userId));
        Hooks.on("updateActiveEffect", (effect, change, options, userId) => handleEffectUpdate(effect, userId));
        Hooks.on("deleteActiveEffect", (effect, options, userId) => handleEffectUpdate(effect, userId));

        Hooks.on("createToken", (doc, options, userId) => {
            if (game.userId !== userId) return;
            const enhancedEffects = getEffects(doc.actor);
            if (enhancedEffects.length > 0) enhanced.applyEffects(doc.actor, enhancedEffects);
        });

        Hooks.on("canvasReady", () => {
            const firstGM = game.users?.find(u => u.isGM && u.active);
            if (game.userId !== firstGM?.id) return;
            
            const linkedTokens = canvas.tokens.placeables.filter(t => !t.document.link);
            for (const token of linkedTokens) {
                const enhancedEffects = getEffects(token.actor);
                if (enhancedEffects.length > 0) enhanced.applyEffects(token.actor, enhancedEffects);
            }
        });

        Hooks.on("updateItem", (item, change, options, userId) => {
            if (game.userId !== userId || !(item.parent instanceof Actor)) return;
            const actor = item.parent;
            enhanced.applyEffects(actor, getEffects(actor));
        });

        const handleItemChange = (item, options, userId) => {
            if (game.userId !== userId || !(item.parent instanceof Actor)) return;
            if (!item.effects.some(e => e.changes.some(c => c.key.startsWith("enhanced.")))) return;
            
            const actor = item.parent;
            enhanced.applyEffects(actor, getEffects(actor)); // Optimized: Only pass active enhanced effects, not all appliedEffects
        };
        Hooks.on("createItem", handleItemChange);
        Hooks.on("deleteItem", handleItemChange);
    }

    static async applyEffects(entity, effects) {
        if (entity.documentName !== "Actor") return;
        const tokenArray = entity.getActiveTokens();
        if (!tokenArray.length) return;

        // 2. REPLACED DUPLICATE WITH DEEPCLONE (V13 Standard)
        const changes = effects.reduce((acc, e) => {
            if (e.disabled || e.isSuppressed) return acc;
            return acc.concat(e.changes.map(c => {
                const clonedChange = deepClone(c);
                clonedChange.effect = e;
                clonedChange.priority = clonedChange.priority ?? (clonedChange.mode * 10);
                return clonedChange;
            }));
        }, []).sort((a, b) => a.priority - b.priority);

        // 3. PARALLEL TOKEN UPDATES
        const tokenUpdatePromises = tokenArray.map(async (token) => {
            let originalDelta = token.document.flags.enhanced?.originals || {};
            const originals = mergeObject(token.document.toObject(), originalDelta);
            let overrides = {};

            const applyOverride = (key, value, preValue) => {
                setProperty(overrides, key, value);
                if (!hasProperty(originalDelta, key)) setProperty(originalDelta, key, preValue);
            };

            for (const change of changes) {
                if (!change.key.includes("enhanced")) continue;
                const updateKey = change.key.slice(9);

                if (updateKey.startsWith("detectionModes.")) {
                    const parts = updateKey.split(".");
                    if (parts.length === 3) {
                        const [_, id, key] = parts;
                        const detectionModes = getProperty(overrides, "detectionModes") || deepClone(getProperty(originals, "detectionModes")) || [];                    
                        let dm = detectionModes.find(dm => dm.id === id);
                        
                        if (!dm) {
                            dm = { id, enabled: true, range: 0 };
                            detectionModes.push(dm);
                        }
                        
                        const fakeChange = deepClone(change);
                        fakeChange.key = key;
                        const result = enhanced.apply(undefined, fakeChange, undefined, dm[key]);
                        
                        if (result !== null) {
                            dm[key] = result;
                            const preValue = getProperty(originals, "detectionModes") || [];
                            applyOverride("detectionModes", detectionModes, preValue);
                        }
                    }
                } else {
                    const preValue = getProperty(overrides, updateKey) || getProperty(originals, updateKey);
                    let result = enhanced.apply(entity, change, originals, preValue);
                    
                    if (change.key === "enhanced.alpha") result = result * result;
                    
                    if (result !== null) {
                        if (updateKey === "light.animation" && typeof result === "string") {
                            let resultTmp;
                            try {
                                resultTmp = JSON.parse(result);
                            } catch (e) {
                                // 4. FIXED VAR SCOPING
                                const fixedJSON = result
                                    .replace(/:\s*"([^"]*)"/g, (match, p1) => ': "' + p1.replace(/:/g, '@colon@') + '"')
                                    .replace(/:\s*'([^']*)'/g, (match, p1) => ': "' + p1.replace(/:/g, '@colon@') + '"')
                                    .replace(/(['"])?([a-z0-9A-Z_]+)(['"])?\s*:/g, '"$2": ')
                                    .replace(/:\s*(['"])?([a-z0-9A-Z_]+)(['"])?/g, ':"$2"')
                                    .replace(/@colon@/g, ':');

                                resultTmp = JSON.parse(fixedJSON);
                                for (const [key, value] of Object.entries(resultTmp)) {
                                    resultTmp[key] = enhanced.switchType(key, value);
                                }
                            }
                            for (const [k, v] of Object.entries(resultTmp)) {
                                const key = `${updateKey}.${k}`;
                                const preValue = getProperty(originals, key);
                                applyOverride(key, v, preValue);
                            }
                        } else if (updateKey === "sight.visionMode") {
                            applyOverride(updateKey, result, preValue);
                            const visionDefaults = CONFIG.Canvas.visionModes[result]?.vision?.defaults || {};
                            for (const [k, v] of Object.entries(visionDefaults)) {
                                const key = `sight.${k}`;
                                const preValue = getProperty(originals, key);
                                applyOverride(key, v, preValue);
                            }
                        } else {
                            applyOverride(updateKey, result, preValue);
                        }
                    }
                }
            }

            overrides["flags.enhanced.originals"] = originalDelta;
            overrides = flattenObject(overrides);
            
            const removeDelta = (key) => {
                const head = key.split(".");
                const tail = `-=${head.pop()}`;
                const deltaKey = ["flags", "enhanced", "originals", ...head, tail].join(".");
                overrides[deltaKey] = null;
            };

            for (const [key, value] of Object.entries(flattenObject(originalDelta))) {
                if (!(key in overrides)) {
                    overrides[key] = value;
                    delete overrides[`flags.enhanced.originals.${key}`];
                    removeDelta(key);
                }
            }
            
            console.log("enhanced | Going to update token", token.document.id, overrides);
            return token.document.update(overrides);
        });

        await Promise.all(tokenUpdatePromises);
    }

    static apply(token, change, originals, preValue) {
        const modes = CONST.ACTIVE_EFFECT_MODES;
        switch (change.mode) {
            case modes.ADD: return enhanced.applyAdd(token, change, originals, preValue);
            case modes.MULTIPLY: return enhanced.applyMultiply(token, change, originals, preValue);
            case modes.OVERRIDE:
            case modes.CUSTOM:
            case modes.UPGRADE:
            case modes.DOWNGRADE: return enhanced.applyOverride(token, change, originals, preValue);
            default: return null;
        }
    }

    static switchType(key, value) {
        // 5. FIXED NAMING COLLISION
        const numericKeys = ["light.dim", "light.bright", "dim", "bright", "scale", "height", "width", "light.angle", "light.alpha", "rotation", "speed", "intensity"];
        const booleanKeys = ["mirrorX", "mirrorY", "light.gradual", "vision"];
        
        if (numericKeys.includes(key)) return parseFloat(value);
        if (booleanKeys.includes(key)) return value === "true";
        return value;
    }

    static applyAdd(token, change, originals, current) {
        let { key, value } = change;
        key = key.slice(9);
        value = enhanced.switchType(key, value);
        const ct = getType(current);
        
        switch (ct) {
            case "null": return parseInt(value);
            case "string": return current + String(value);
            case "number": return Number.isNumeric(value) ? current + Number(value) : null;
            case "Array": return (!current.length || getType(value) === getType(current[0])) ? current.concat([value]) : null;
            default: return null;
        }
    }

    static applyMultiply(token, change, originals, current) {
        let { key, value } = change;
        key = key.slice(9);
        value = enhanced.switchType(key, value);

        if (typeof current !== "number" || typeof value !== "number") return null;
        return current * value;
    }

    static applyOverride(token, change, originals, current) {
        let { key, value, mode } = change;
        key = key.slice(9);
        value = enhanced.switchType(key, value);
        
        if (mode === CONST.ACTIVE_EFFECT_MODES.UPGRADE && typeof current === "number" && current >= Number(value)) return null;
        if (mode === CONST.ACTIVE_EFFECT_MODES.DOWNGRADE && typeof current === "number" && current < Number(value)) return null;
        
        return typeof current === "number" ? Number(value) : value;
    }
}

Hooks.on('ready', enhanced.ready);
