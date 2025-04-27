const { deepClone, duplicate, flattenObject, getProperty, hasProperty, mergeObject, setProperty } = foundry.utils;

class EAE {
    static async ready() {
        const getEffects = (actor) => {
            if (!actor) return [];
            return actor.appliedEffects.filter(e => e.changes.some(c => c.key.startsWith("EAE.")));
        };

        Hooks.on("updateActiveEffect", async (effect, change, options, userId) => {
            if (game.userId !== userId) return;
            
            let actor;
            if (effect.parent instanceof Actor) actor = effect.parent;
            else if (effect.parent?.parent instanceof Actor) actor = effect.parent.parent;
            else return;
            
            let EAEeffects = getEffects(actor);
            EAE.applyEffects(actor, EAEeffects);
        });

        Hooks.on("createActiveEffect", async (effect, options, userId) => {
            if (game.userId !== userId || effect.disabled || effect.isSuppressed) return;
            
            let actor;
            if (effect.parent instanceof Actor) actor = effect.parent;
            else if (effect.parent?.parent instanceof Actor) actor = effect.parent.parent;
            else return;
            
            if (!effect.changes?.some(c => c.key.startsWith("EAE."))) return;
            
            let EAEeffects = getEffects(actor);
            EAE.applyEffects(actor, EAEeffects);
        });

        Hooks.on("deleteActiveEffect", async (effect, options, userId) => {
            if (game.userId !== userId || effect.disabled || effect.isSuppressed) return;
            
            let actor;
            if (effect.parent instanceof Actor) actor = effect.parent;
            else if (effect.parent?.parent instanceof Actor) actor = effect.parent.parent;
            else return;
            
            if (!effect.changes?.some(c => c.key.startsWith("EAE."))) return;
            
            let EAEeffects = getEffects(actor);
            EAE.applyEffects(actor, EAEeffects);
        });

        Hooks.on("createToken", (doc, options, userId) => {
            if (game.userId !== userId) return;
            let EAEeffects = getEffects(doc.actor);
            if (EAEeffects.length > 0) EAE.applyEffects(doc.actor, EAEeffects);
        });

        Hooks.on("canvasReady", () => {
            const firstGM = game.users?.find(u => u.isGM && u.active);
            if (game.userId !== firstGM?.id) return;
            let linkedTokens = canvas.tokens.placeables.filter(t => !t.document.link);
            for (let token of linkedTokens) {
                let EAEeffects = getEffects(token.actor);
                if (EAEeffects.length > 0) EAE.applyEffects(token.actor, EAEeffects);
            }
        });

        Hooks.on("updateItem", (item, change, options, userId) => {
            if (game.userId !== userId || !item.parent) return;
            if (hasProperty(change, "system.equipped") || hasProperty(change, "system.attunement")) {
                let actor = item.parent;
                let EAEeffects = getEffects(actor);
                EAE.applyEffects(actor, EAEeffects);
            }
        });
        
        Hooks.on("createItem", (item, options, userId) => {
            if (game.userId !== userId || !(item.parent instanceof Actor)) return;
            if (!item.effects.some(e => e.changes.some(c => c.key.startsWith("EAE.")))) return;
            const actor = item.parent;
            EAE.applyEffects(actor, actor.appliedEffects);
        });
        
        Hooks.on("deleteItem", (item, options, userId) => {
            if (game.userId !== userId || !(item.parent instanceof Actor)) return;
            if (!item.effects.some(e => e.changes.some(c => c.key.startsWith("EAE.")))) return;
            const actor = item.parent;
            EAE.applyEffects(actor, actor.appliedEffects);
        });
    }

    static async applyEffects(entity, effects) {
        if (entity.documentName !== "Actor") return;
        const tokenArray = entity.getActiveTokens();
        if (!tokenArray.length) return;

        const changes = effects.reduce((changes, e) => {
            if (e.disabled || e.isSuppressed) return changes;
            return changes.concat(e.changes.map(c => {
                c = duplicate(c);
                c.effect = e;
                c.priority = c.priority ?? (c.mode * 10);
                return c;
            }));
        }, []);
        changes.sort((a, b) => a.priority - b.priority);

        for (const token of tokenArray) {
            let originalDelta = token.document.flags.EAE?.originals || {};
            const originals = mergeObject(token.document.toObject(), originalDelta);
            let overrides = {};

            const applyOverride = (key, value, preValue) => {
                setProperty(overrides, key, value);
                if (!hasProperty(originalDelta, key)) setProperty(originalDelta, key, preValue);
            };

            for (let change of changes) {
                if (!change.key.includes("EAE")) continue;
                let updateKey = change.key.slice(4);
                if (updateKey.startsWith("detectionModes.")) {
                    const parts = updateKey.split(".");
                    if (parts.length === 3) {
                        const [_, id, key] = parts;
                        const detectionModes =
                            getProperty(overrides, "detectionModes") ||
                            duplicate(getProperty(originals, "detectionModes")) ||
                            [];                    
                        let dm = detectionModes.find(dm => dm.id === id);
                        if (!dm) {
                            dm = { id, enabled: false, range: 0 };
                            detectionModes.push(dm);
                        }
                        const fakeChange = duplicate(change);
                        fakeChange.key = key;
                        const result = EAE.apply(undefined, fakeChange, undefined, dm[key] ?? null);
                        if (result !== null) {
                            dm[key] = result;
                            const preValue = getProperty(originals, "detectionModes") || [];
                            applyOverride("detectionModes", detectionModes, preValue);
                        }
                    }
                } else {
                    let preValue = getProperty(overrides, updateKey) || getProperty(originals, updateKey);
                    let result = EAE.apply(entity, change, originals, preValue);
                    if (change.key === "EAE.alpha") result = result * result;
                    if (result !== null) {
                        if (updateKey === "light.animation" && typeof result === "string") {
                            let resultTmp;
                            try {
                                resultTmp = JSON.parse(result);
                            } catch (e) {
                                let fixedJSON;
                                try {
                                    fixedJSON = result
                                        .replace(/:\s*"([^"]*)"/g, function (match, p1) {
                                            return ': "' + p1.replace(/:/g, '@colon@') + '"';
                                        })
                                        .replace(/:\s*'([^']*)'/g, function (match, p1) {
                                            return ': "' + p1.replace(/:/g, '@colon@') + '"';
                                        })
                                        .replace(/(['"])?([a-z0-9A-Z_]+)(['"])?\s*:/g, '"$2": ')
                                        .replace(/:\s*(['"])?([a-z0-9A-Z_]+)(['"])?/g, ':"$2"')
                                        .replace(/@colon@/g, ':');

                                    try {
                                        resultTmp = JSON.parse(fixedJSON);
                                        for (const [key, value] of Object.entries(resultTmp)) {
                                            resultTmp[key] = EAE.switchType(key, value);
                                        }
                                    } catch (jsonError) {
                                        continue;
                                    }
                                } catch (err) {
                                    continue;
                                }
                            }
                            for (let [k, v] of Object.entries(resultTmp)) {
                                const key = `${updateKey}.${k}`;
                                const preValue = getProperty(originals, key);
                                applyOverride(key, v, preValue);
                            }
                        }
                        else if (updateKey === "sight.visionMode") {
                            applyOverride(updateKey, result, preValue);
                            const visionDefaults = CONFIG.Canvas.visionModes[result]?.vision?.defaults || {};
                            for (let [k, v] of Object.entries(visionDefaults)) {
                                const key = `sight.${k}`;
                                const preValue = getProperty(originals, key);
                                applyOverride(key, v, preValue);
                            }
                        }
                        else
                            applyOverride(updateKey, result, preValue);
                    }
                }
            }

            overrides["flags.EAE.originals"] = originalDelta;
            overrides = flattenObject(overrides);
            const removeDelta = (key) => {
                const head = key.split(".");
                const tail = `-=${head.pop()}`;
                key = ["flags", "EAE", "originals", ...head, tail].join(".");
                overrides[key] = null;
            };
            for (const [key, value] of Object.entries(flattenObject(originalDelta))) {
                if (!(key in overrides)) {
                    overrides[key] = value;
                    delete overrides[`flags.EAE.originals.${key}`];
                    removeDelta(key);
                }
            }
            await token.document.update(overrides);
        }
    }

    static apply(token, change, originals, preValue) {
        const modes = CONST.ACTIVE_EFFECT_MODES;
        switch (change.mode) {
            case modes.ADD:
                return EAE.applyAdd(token, change, originals, preValue);
            case modes.MULTIPLY:
                return EAE.applyMultiply(token, change, originals, preValue);
            case modes.OVERRIDE:
            case modes.CUSTOM:
            case modes.UPGRADE:
            case modes.DOWNGRADE:
                return EAE.applyOverride(token, change, originals, preValue);
        }
    }

    static switchType(key, value) {
        let numeric = ["light.dim", "light.bright", "dim", "bright", "scale", "height", "width", "light.angle", "light.alpha", "rotation", "speed", "intensity"];
        let Boolean = ["mirrorX", "mirrorY", "light.gradual", "vision"];
        if (numeric.includes(key)) return parseFloat(value);
        else if (Boolean.includes(key)) {
            if (value === "true") return true;
            if (value === "false") return false;
        }
        else return value;
    }

    static applyAdd(token, change, originals, current) {
        let { key, value } = change;
        key = key.slice(4);
        value = EAE.switchType(key, value);
        const ct = getType(current);
        let update = null;

        switch (ct) {
            case "null":
                update = parseInt(value);
                break;
            case "string":
                update = current + String(value);
                break;
            case "number":
                if (Number.isNumeric(value)) update = current + Number(value);
                break;
            case "Array":
                if (!current.length || (getType(value) === getType(current[0]))) update = current.concat([value]);
        }
        return update;
    }

    static applyMultiply(token, change, originals, current) {
        let { key, value } = change;
        key = key.slice(4);
        value = EAE.switchType(key, value);

        if ((typeof (current) !== "number") || (typeof (value) !== "number")) return null;
        const update = current * value;
        return update;
    }

    static applyOverride(token, change, originals, current) {
        let { key, value, mode } = change;
        key = key.slice(4);
        value = EAE.switchType(key, value);
        if (mode === CONST.ACTIVE_EFFECT_MODES.UPGRADE) {
            if ((typeof (current) === "number") && (current >= Number(value))) return null;
        }
        if (mode === CONST.ACTIVE_EFFECT_MODES.DOWNGRADE) {
            if ((typeof (current) === "number") && (current < Number(value))) return null;
        }
        if (typeof current === "number") return Number(value);
        return value;
    }
}

Hooks.once('ready', EAE.ready);