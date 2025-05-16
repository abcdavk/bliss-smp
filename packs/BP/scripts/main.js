import { EnchantmentType, EntityComponentTypes, EntityDamageCause, EquipmentSlot, ItemComponentTypes, system, world } from "@minecraft/server";
const gemsRegistry = [
    {
        item: "gem:strength",
        addEffect: [{
                type: 'strength',
                amplifier: 1
            }],
        addEnchantment: [{
                type_includes: 'sword',
                enchantment_type: 'sharpness',
                level: 2
            }],
        executeOnHit: function (player, hitEntity) {
            const health = player.getComponent(EntityComponentTypes.Health);
            if (!health)
                return;
            const { currentValue, defaultValue } = health;
            const bonusDamage = Math.floor(Math.sqrt(defaultValue - currentValue));
            if (bonusDamage > 1) {
                hitEntity.applyDamage(bonusDamage, {
                    damagingEntity: player,
                    cause: EntityDamageCause.entityAttack
                });
                player.sendMessage(`${player.nameTag} apply ${bonusDamage} bonus damage to ${hitEntity.typeId}`);
            }
        },
        executeInterval: function (player) {
        },
        executeItemUse: function (data) {
        }
    }
];
world.afterEvents.itemUse.subscribe((data) => {
    const { itemStack, source: player } = data;
    gemsRegistry.forEach(gem => {
        if (gem.item === itemStack.typeId) {
            gem.executeItemUse(data);
        }
    });
});
world.afterEvents.entityHitEntity.subscribe((data) => {
    const { damagingEntity: player, hitEntity } = data;
    if (player.typeId === "minecraft:player") {
        gemsRegistry.forEach(gem => {
            gem.executeOnHit(player, hitEntity);
        });
    }
});
system.runInterval(() => {
    world.getPlayers().forEach(player => {
        const equip = player.getComponent(EntityComponentTypes.Equippable);
        const offhandItem = equip?.getEquipment(EquipmentSlot.Offhand);
        if (!offhandItem)
            return;
        gemsRegistry.forEach(gem => {
            if (gem.item === offhandItem.typeId) {
                gem.executeInterval(player);
                if (gem.addEffect) {
                    gem.addEffect.forEach(effect => {
                        player.addEffect(effect.type, 50, {
                            amplifier: effect.amplifier,
                            showParticles: false
                        });
                    });
                }
                if (gem.addEnchantment) {
                    gem.addEnchantment.forEach(enchantment => {
                        const inv = player.getComponent(EntityComponentTypes.Inventory);
                        const con = inv?.container;
                        if (inv && con) {
                            for (let i = 0; i < inv.inventorySize; i++) {
                                const itemStack = con.getItem(i);
                                if (itemStack?.typeId.includes(enchantment.type_includes)) {
                                    const hasEnchantment = itemStack.getDynamicProperty('bliss:has_enchantment');
                                    if (hasEnchantment)
                                        return;
                                    const enchant = itemStack.getComponent(ItemComponentTypes.Enchantable);
                                    enchant?.addEnchantment({
                                        type: new EnchantmentType(enchantment.enchantment_type),
                                        level: enchantment.level
                                    });
                                    itemStack.setDynamicProperty('bliss:has_enchantment', true);
                                    con.setItem(i, itemStack);
                                }
                            }
                        }
                    });
                }
            }
        });
    });
});
