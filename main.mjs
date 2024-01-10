import { ATTACK, HEAL, RANGED_ATTACK, ERR_NOT_IN_RANGE, RESOURCE_ENERGY } from "game/constants";
import { BodyPart, Flag } from "arena";
import { Creep, GameObject, StructureTower } from "game/prototypes";
import { getDirection, getObjectsByPrototype, getRange, getTicks } from "game/utils";
import { searchPath } from "game/path-finder";
import { Visual } from "game/visual";

var healCoef = 2.0

export function loop() {
    var enemyFlag = getObjectsByPrototype(Flag).find(object => !object.my);
    var myCreeps = getObjectsByPrototype(Creep).filter(object => object.my);

    var attackCreeps = [];
    var rangedCreeps = [];
    var healCreeps = [];
    var defensive = false;
    var flagDefended = false;

    
    myCreeps.forEach(creep => 
    {
        if(creep.hits < creep.hitsMax * .7)
        {
            defensive = true;
        }
    });
    
    var enemyCreeps = getObjectsByPrototype(Creep).filter(object => !object.my);
    
    var parts = getObjectsByPrototype(BodyPart);
    for(var part of parts)
    {
    
        myCreeps.sort((a, b) => getRange(a, part) - getRange(b, part));
        var confidence = calculateConfidence(myCreeps[0], myCreeps, enemyCreeps)
        if(confidence > 80)
        {
            myCreeps[0].moveTo(part);
            myCreeps.shift();
        }
    }

    myCreeps.forEach(creep => 
    {
        if (creep.body.some(i => i.type === RANGED_ATTACK)) {
            rangedCreeps.push(creep)
        }
        else if (creep.body.some(i => i.type === ATTACK)) {
            attackCreeps.push(creep)
        }
        else if (creep.body.some(i => i.type === HEAL)) {
            healCreeps.push(creep)
        }
    });
    

    // get closest creep to the flag
    var myFlag = getObjectsByPrototype(Flag).find(object => object.my);

    
    enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));  
    rangedCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));

    var enemyIndex = 0;
    var rangedIndex = 0;
    while(rangedCreeps.length > rangedIndex && enemyCreeps.length > enemyIndex)
    {
        if(getRange(enemyCreeps[enemyIndex], myFlag) < getRange(rangedCreeps[0], myFlag) + 1)
        {
            defensive = true;
        }
        rangedIndex++;
    }

    
    var meleeIndex = 0;
    attackCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));
    while(attackCreeps.length > meleeIndex && enemyCreeps.length > enemyIndex)
    {
        if(getRange(enemyCreeps[enemyIndex], myFlag) < getRange(attackCreeps[0], myFlag) + 1)
        {
            defensive = true;
        }

        meleeIndex++;
    }


    attackCreeps.forEach(creep => meleeAttacker(creep, enemyCreeps, enemyFlag, myFlag, healCreeps, myCreeps, defensive));
    rangedCreeps.forEach(creep => rangedAttacker(creep, enemyCreeps, myCreeps, healCreeps, myFlag, enemyFlag, defensive));
    healCreeps.forEach(creep => healer(creep, myCreeps, attackCreeps, healCreeps, myFlag, enemyFlag, defensive));

    var myTowers = getObjectsByPrototype(StructureTower).filter(object => object.my);
    for(var tower of myTowers)
    {
        towerProd(tower, enemyCreeps, myCreeps);
    }
}

function meleeAttacker(creep, enemyCreeps, enemyFlag, myFlag, myHealers, myCreeps, defensive)
{
    enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    myHealers.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    var confidence = calculateConfidence(creep, myCreeps, enemyCreeps);
    if(!defensive && confidence > 120 && enemyCreeps.length > 0)
    {
        enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
        creep.moveTo(enemyCreeps[0]);  
        creep.attack(enemyCreeps[0]);   
        console.log("melee attacking closest enemy.")
        return;
    }
    else if (defensive&& enemyCreeps.length > 0)
    {
        enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));
        creep.moveTo(enemyCreeps[0]);  
        creep.attack(enemyCreeps[0]);   
        return;    
    }

    if(enemyCreeps.length == 0)
    {        
        creep.moveTo(enemyFlag);
        return;
    }
    else
    {
        creep.moveTo(myFlag);
        if(enemyCreeps.length > 0)
        {
            creep.attack(enemyCreeps[0]);
        }
    }
}

function calculateConfidence(creep, myCreeps, enemyCreeps)
{
    var confidence = 0;
    for(var friendlyCreep of myCreeps)
    {
        var creepRange = getRange(friendlyCreep, creep);
        if(creepRange < 30)
        {
            confidence = confidence + 120 - creepRange; 
        }
    }

    if(enemyCreeps.length == 0)
    {
        confidence = confidence + 200;
    }

    if(getTicks() > 1650)
    {
        confidence = confidence + 10000;
    }

    for(var enemyCreep of enemyCreeps)
    {
        var creepRange = getRange(enemyCreep, creep);
        if(creepRange < 30)
        {
            confidence = confidence - 500/creepRange;
        }
    }

    return confidence * creep.hits / creep.hitsMax;
}

function rangedAttacker(creep, enemyCreeps, myCreeps, myHealers, myFlag, enemyFlag, defensive)
{    
    if(enemyCreeps.length == 0)
    {        
        creep.moveTo(enemyFlag);
        return;
    }

    var confidence = calculateConfidence(creep, myCreeps, enemyCreeps);
    if(!defensive && confidence > 80 && enemyCreeps.length > 0)
    {
        enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));
        creep.moveTo(enemyCreeps[0]);
        enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
        creep.rangedAttack(enemyCreeps[0]);
        console.log("moving to enemy creep closest to flag");
        return;
    }
    else
    {
        enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
        creep.rangedAttack(enemyCreeps[0]);
        creep.moveTo(myFlag);
        return;
    }
}

function healer(creep, myCreeps, meleeCreeps, myHealers, myFlag, enemyFlag, defensive)
{
    // Find nearest friendly creep
    var healableCreeps = myCreeps.filter(i => i.hits < i.hitsMax && i != creep).sort((a, b) => getRange(a, creep) - getRange(b, creep));
    var validHealers = myHealers.filter(i => i != creep).sort((a, b) => getRange(a, creep) - getRange(b, creep));

    if(creep.hits < creep.hitsMax * .9 && validHealers.length > 0)
    {
        creep.moveTo(myFlag);
    }
    
    if(healableCreeps.length > 0)
    {
        creep.pull(healableCreeps[0]);
        creep.heal(healableCreeps[0]);
        creep.rangedHeal(healableCreeps[0]);

        if(getRange(creep, healableCreeps[0]) <2)
        {
            creep.moveTo(myFlag);        
        }
        else
        {
            creep.moveTo(healableCreeps[0]);
        }
        return;
    }

    meleeCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag))
    console.log(meleeCreeps[0]);
    creep.moveTo(meleeCreeps[0]);
    
}

function towerProd(tower, enemyCreeps, myCreeps) {
    const target = enemyCreeps.filter(i => getRange(i, tower) < 5).sort((a, b) => a.hits - b.hits);
    const healTarget = myCreeps.filter(i => getRange(i, tower) < 51 && i.hits < i.hitsMax).sort((a, b) => a.hits - b.hits)

    //TODO: attack enemy creeps

    if (target.length > 0) 
    {
        tower.attack(target[0])
        return;
    }
    
    
    if(tower.store[RESOURCE_ENERGY] < 50)
    {
        console.log("Tower cannot heal");
        return;
    }

    if (healTarget.length > 0)
    {
        tower.heal(healTarget[0])
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