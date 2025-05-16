import { EnchantmentType, Entity, EntityComponentTypes, EntityDamageCause, EquipmentSlot, ItemComponentTypes, ItemUseAfterEvent, Player, system, world } from "@minecraft/server";

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
    executeOnHit: function(player: Player, hitEntity: Entity) {
      const health = player.getComponent(EntityComponentTypes.Health);
      if (!health) return;
      const { currentValue, defaultValue } = health;
      const bonusDamage = Math.floor(Math.sqrt(defaultValue - currentValue));
      if (bonusDamage > 1) {
        hitEntity.applyDamage(bonusDamage, { 
          damagingEntity: player,
          cause: EntityDamageCause.entityAttack
        });
        player.sendMessage(`${player.nameTag} apply ${bonusDamage} bonus damage to ${hitEntity.typeId}`)
      }
    },
    executeInterval: function(player: Player) {
      
    },
    onUse: [
      {
        executeItemUse: function(data: ItemUseAfterEvent) {
          const { source: player } = data;
          player.sendMessage(`Using gems skills 0`);
        }
      },
      {
        executeItemUse: function(data: ItemUseAfterEvent) {
          const { source: player } = data;
          player.sendMessage(`Using gems skills 1`);
        }
      }
    ]
  }
];

world.afterEvents.itemUse.subscribe((data) => {
  const { itemStack, source: player } = data;
  const equip = player.getComponent(EntityComponentTypes.Equippable);
  const offhandItem = equip?.getEquipment(EquipmentSlot.Offhand);
  const cooldownOffhand = offhandItem?.getComponent(ItemComponentTypes.Cooldown);
  const cooldownMainhand = itemStack.getComponent(ItemComponentTypes.Cooldown);
  const tickOff = cooldownOffhand?.getCooldownTicksRemaining(player);
  const tickMain = cooldownMainhand?.getCooldownTicksRemaining(player);
  const powerSelectOff = offhandItem?.getDynamicProperty('bliss:power_selected') as number;
  const powerSelectMain = itemStack.getDynamicProperty('bliss:power_selected') as number;
  gemsRegistry.forEach(gem => {
    if (
      gem.item === itemStack.typeId || 
      (gem.item === offhandItem?.typeId && itemStack.typeId.includes('sword'))
    ) {

      if (tickOff === 0 || tickMain === 0) {
        if (!player.isSneaking) {
          if (powerSelectOff !== undefined) {
            gem.onUse[powerSelectOff as number].executeItemUse(data);
            cooldownOffhand?.startCooldown(player);
          } else if (powerSelectMain !== undefined) {
            gem.onUse[powerSelectMain as number].executeItemUse(data);
            cooldownMainhand?.startCooldown(player);
          }
        } else {
          const powerTotal = gem.onUse.length;
          if (powerSelectOff !== undefined) {
            cooldownOffhand?.startCooldown(player);
            if (powerSelectOff + 1 < powerTotal) {
              offhandItem?.setDynamicProperty('bliss:power_selected', powerSelectOff + 1);
              equip?.setEquipment(EquipmentSlot.Offhand, offhandItem);
            } else {
              offhandItem?.setDynamicProperty('bliss:power_selected', 0);
              equip?.setEquipment(EquipmentSlot.Offhand, offhandItem);
            }
          } else if (powerSelectMain !== undefined) {
            cooldownMainhand?.startCooldown(player);
            if (powerSelectMain + 1 < powerTotal) {
              itemStack?.setDynamicProperty('bliss:power_selected', powerSelectMain + 1);
              equip?.setEquipment(EquipmentSlot.Offhand, itemStack);
            } else {
              itemStack?.setDynamicProperty('bliss:power_selected', 0);
              equip?.setEquipment(EquipmentSlot.Offhand, itemStack);
            }
          }
        }
      }
    }
  });
});

world.afterEvents.entityHitEntity.subscribe((data) => {
  const { damagingEntity: player, hitEntity } = data;
  if (player.typeId === "minecraft:player") {
    const equip = player.getComponent(EntityComponentTypes.Equippable);
    const offhandItem = equip?.getEquipment(EquipmentSlot.Offhand);
    gemsRegistry.forEach(gem => {
      if (gem.item === offhandItem?.typeId) {
        gem.executeOnHit(player as Player, hitEntity);
      }
    });
  }
});

system.runInterval(() => {
  world.getPlayers().forEach(player => {
    const inv = player.getComponent(EntityComponentTypes.Inventory);
    const con = inv?.container;
    const equip = player.getComponent(EntityComponentTypes.Equippable);
    const offhandItem = equip?.getEquipment(EquipmentSlot.Offhand);
    const mainhandItem = equip?.getEquipment(EquipmentSlot.Mainhand);
    if (offhandItem || mainhandItem) {
      gemsRegistry.forEach(gem => {
        if (gem.item === offhandItem?.typeId || gem.item === mainhandItem?.typeId) {
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
              if (inv && con) {
                for (let i = 0; i < inv.inventorySize; i++) {
                  const itemStack = con.getItem(i);
                  if (itemStack?.typeId.includes(enchantment.type_includes)) {
                    const hasEnchantment = itemStack.getDynamicProperty('bliss:has_enchantment');
  
                    if (hasEnchantment) return; 
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
      })
    }


    if (inv && con) {
      for (let i = 0; i < inv.inventorySize; i++) {
        const itemStack = con.getItem(i);
        if (itemStack?.typeId.includes('gem:') && itemStack.getDynamicProperty('bliss:power_selected') === undefined) {
          itemStack.setDynamicProperty('bliss:power_selected', 0);
          con.setItem(i, itemStack);
        }
      }
    }
  });
});