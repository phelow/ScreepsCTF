import { ATTACK, HEAL, RANGED_ATTACK } from "game/constants";
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
    attackCreeps.forEach(creep => meleeAttacker(creep, enemyCreeps, myCreeps, enemyFlag));
    rangedCreeps.forEach(creep => rangedAttacker(creep, enemyCreeps, myCreeps));
    healCreeps.forEach(creep => healer(creep, myCreeps));

    var myTowers = getObjectsByPrototype(StructureTower).filter(object => object.my);
    for(var tower of myTowers)
    {
        towerProd(tower, enemyCreeps, myCreeps);
    }
}

function meleeAttacker(creep, enemyCreeps, myCreeps, enemyFlag)
{
    enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
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
        creep.attack(enemyCreeps[0]);
        creep.moveTo(enemyCreeps[0]);
    }
    else
    {
        myCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
        if(myCreeps.length > 1)
        {
            creep.moveTo(myCreeps[1]);
        }
    }

}

function healer(creep, myCreeps)
{
    // Find nearest friendly creep
    for(var targetCreep of myCreeps.filter(i => i.hits < i.hitsMax).sort((a, b) => getRange(a, creep) - getRange(b, creep)))
    {
        if(creep != targetCreep)
        {
            creep.heal(targetCreep);
            creep.moveTo(targetCreep);
            return;
        }
    }

    myCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    if(myCreeps.length > 1)
    {
        creep.moveTo(myCreeps[1]);
    }

}

function towerProd(tower, enemyCreeps, myCreeps) {
    const target = tower.findInRange(enemyCreeps, 5)
    const healTarget = myCreeps.filter(i => getRange(i, tower) < 51 && i.hits < i.hitsMax).sort((a, b) => a.hits - b.hits)

    if (target.length > 0) 
    {
        tower.attack(target[0])
    }
    else if (healTarget.length)
    {
        tower.heal(healTarget[0])
    }
}