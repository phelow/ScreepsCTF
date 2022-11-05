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

    // get closest creep to the flag
    var myFlag = getObjectsByPrototype(Flag).find(object => object.my);

    
    attackCreeps.sort((a, b) => a.hits - b.hits);
    for(var creep of attackCreeps)
    {
        if(creep.hits < creep.hitsMax/1.3 && healCreeps.length > 0)
        {
            enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
            healCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
            creep.moveTo(healCreeps[0]);
            creep.attack(enemyCreeps[0]);
            attackCreeps.shift();
            break;
        }
    }

    
    enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));  
    attackCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));
    var defensive = attackCreeps.length > 0 && enemyCreeps.length > 0 && getRange(enemyCreeps[0], myFlag) < getRange(attackCreeps[0], myFlag) + 5; 
    if(defensive && getRange(attackCreeps[0], myFlag) > 0)
    {
        console.log("retreating");
        attackCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));    
        attackCreeps[0].moveTo(myFlag);
        attackCreeps.shift();
    }
    else
    {       
        var parts = getObjectsByPrototype(BodyPart);
        for(var part of parts)
        {
            myCreeps.sort((a, b) => getRange(a, part) - getRange(b, part));    
            myCreeps[0].moveTo(part);
            myCreeps.shift();
        }
    }

    attackCreeps.forEach(creep => meleeAttacker(creep, enemyCreeps, enemyFlag, myFlag, healCreeps, defensive));
    rangedCreeps.forEach(creep => rangedAttacker(creep, enemyCreeps, attackCreeps, healCreeps));
    healCreeps.forEach(creep => healer(creep, attackCreeps, rangedCreeps));

    var myTowers = getObjectsByPrototype(StructureTower).filter(object => object.my);
    for(var tower of myTowers)
    {
        towerProd(tower, enemyCreeps, myCreeps);
    }
}

function meleeAttacker(creep, enemyCreeps, enemyFlag, myFlag, myHealers, defensive)
{
    enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    myHealers.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    if(creep.hits < creep.hitsMax/1.2 && myHealers.length > 0)
    {
        creep.moveTo(myHealers[0]);
        creep.attack(enemyCreeps[0]);
        return;
    }

    if(enemyCreeps.length > 0)
    {
        if(ERR_NOT_IN_RANGE == creep.attack(enemyCreeps[0]))
        {
            creep.moveTo(enemyCreeps[0]);
        }
    }
    else if (defensive)
    {
        creep.moveTo(myFlag);
    }
    else
    {
        creep.moveTo(enemyFlag);
    }
}

function rangedAttacker(creep, enemyCreeps, myCreeps, myHealers)
{    
    console.log(creep);
    var inRange = creep.findInRange(enemyCreeps, 3).sort((a, b) => a.hits - b.hits);

    enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    myHealers.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    if(creep.hits < creep.hitsMax/1.1 && myHealers.length > 0)
    {
        creep.moveTo(myHealers[0]);
        creep.rangedAttack(enemyCreeps[0]);
        return;
    }

    if(inRange.length > 0)
    {
        creep.rangedAttack(inRange[0]);        
        return;
    }

    if(enemyCreeps.length > 0)
    {
        if(ERR_NOT_IN_RANGE == creep.rangedAttack(enemyCreeps[0]))
        {
            myCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
            if(myCreeps.length > 0)
            {
                creep.moveTo(myCreeps[0]);
            }
            else
            {
                creep.moveTo(enemyCreeps[0]);
            }
        }
    }

}

function healer(creep, meleeCreeps, rangedCreeps)
{
    // Find nearest friendly creep
    var healableMelees = meleeCreeps.filter(i => i.hits < i.hitsMax).sort((a, b) => getRange(a, creep) - getRange(b, creep));
    if(healableMelees.length > 0)
    {
        creep.heal(healableMelees[0]);
        creep.moveTo(healableMelees[0]);
        return;
    }

    var healableRangeds = rangedCreeps.filter(i => i.hits < i.hitsMax).sort((a, b) => getRange(a, creep) - getRange(b, creep));
    if(healableRangeds.length > 0)
    {
        creep.heal(healableRangeds[0]);
        creep.moveTo(healableRangeds[0]);
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

    //TODO: attack enemy creeps

    if (target.length > 0) 
    {
        tower.attack(target[0])
        return;
    }
    else if (healTarget.length > 0)
    {
        tower.heal(healTarget[0])
        return;
    }
    
    if(tower.energy < tower.energyCapacity)
    {
        return;
    }

    const distanceHealTarget = myCreeps.filter(i => i.hits < i.hitsMax).sort((a, b) => a.hits - b.hits)

    //TODO: attack enemy creeps

    if (distanceHealTarget.length > 0)
    {
        tower.heal(distanceHealTarget[0])
        return;
    }
}