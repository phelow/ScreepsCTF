import { ATTACK, HEAL, RANGED_ATTACK, ERR_NOT_IN_RANGE } from "game/constants";
import { BodyPart, Flag } from "arena";
import { Creep, GameObject, StructureTower } from "game/prototypes";
import { getDirection, getObjectsByPrototype, getRange, getTicks } from "game/utils";
import { searchPath } from "game/path-finder";
import { Visual } from "game/visual";

export function loop() {
    var enemyFlag = getObjectsByPrototype(Flag).find(object => !object.my);
    var myCreeps = getObjectsByPrototype(Creep).filter(object => object.my);

    var attackCreeps = [];
    var rangedCreeps = [];
    var healCreeps = [];

    
    var parts = getObjectsByPrototype(BodyPart);
    for(var part of parts)
    {
        myCreeps.sort((a, b) => getRange(a, part) - getRange(b, part));    
        myCreeps[0].moveTo(part);
        delete myCreeps[0];
    }

    myCreeps.forEach(creep => {
        if (creep.body.some(i => i.type === ATTACK)) {
            attackCreeps.push(creep)
        }
        else if (creep.body.some(i => i.type === RANGED_ATTACK)) {
            rangedCreeps.push(creep)
        }
        else if (creep.body.some(i => i.type === HEAL)) {
            healCreeps.push(creep)
        }
    });

    
    var enemyCreeps = getObjectsByPrototype(Creep).filter(object => !object.my);
    attackCreeps.forEach(creep => meleeAttacker(creep, enemyCreeps, myCreeps, enemyFlag, healCreeps));
    rangedCreeps.forEach(creep => rangedAttacker(creep, enemyCreeps, attackCreeps));
    healCreeps.forEach(creep => healer(creep, attackCreeps, rangedCreeps));

    var myTowers = getObjectsByPrototype(StructureTower).filter(object => object.my);
    for(var tower of myTowers)
    {
        towerProd(tower, enemyCreeps, myCreeps);
    }
}

function meleeAttacker(creep, enemyCreeps, myCreeps, enemyFlag, myHealers)
{
    enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    myHealers.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    if(creep.hits < creep.hitsMax/2 && myHealers.length > 0)
    {
        creep.attack(enemyCreeps[0]);
        creep.moveTo(myHealers[0]);
        return;
    }

    if(enemyCreeps.length > 0)
    {
        creep.attack(enemyCreeps[0]);
        creep.moveTo(enemyCreeps[0]);
    }
    else
    {
        creep.moveTo(enemyFlag);
    }
}

function rangedAttacker(creep, enemyCreeps, myCreeps)
{
    enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    if(enemyCreeps.length > 0)
    {
        if(ERR_NOT_IN_RANGE == creep.rangedAttack(enemyCreeps[0]))
        {
            myCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
            if(myCreeps.length > 1)
            {
                creep.moveTo(myCreeps[1]);
            }
        }
    }

}

function healer(creep, meleeCreeps, rangedCreeps)
{
    // Find nearest friendly creep
    for(var targetCreep of meleeCreeps.filter(i => i.hits < i.hitsMax).sort((a, b) => getRange(a, creep) - getRange(b, creep)))
    {
        creep.heal(targetCreep);
        creep.moveTo(targetCreep);
        return;
    }

    for(var targetCreep of rangedCreeps.filter(i => i.hits < i.hitsMax).sort((a, b) => getRange(a, creep) - getRange(b, creep)))
    {
        creep.heal(targetCreep);
        creep.moveTo(targetCreep);
        return;
    }

    meleeCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    if(meleeCreeps.length > 0)
    {
        creep.moveTo(meleeCreeps[0]);
    }

}

function towerProd(tower, enemyCreeps, myCreeps) {
    const target = tower.findInRange(enemyCreeps, 5)
    const healTarget = myCreeps.filter(i => getRange(i, tower) < 51 && i.hits < i.hitsMax).sort((a, b) => a.hits - b.hits)

    if (target.length > 0) 
    {
        tower.attack(target[0])
    }
    else if (healTarget.length > 0)
    {
        tower.heal(healTarget[0])
    }
}