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
    
    if(!defensive)
    {
        var parts = getObjectsByPrototype(BodyPart);
        for(var part of parts)
        {
            myCreeps.sort((a, b) => getRange(a, part) - getRange(b, part));   
            myCreeps[0].moveTo(part);
            myCreeps.shift();
        }
    }

    myCreeps.forEach(creep => 
    {
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

    
    enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));  
    rangedCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));

    var enemyIndex = 0;
    var rangedIndex = 0;
    while(rangedCreeps.length > rangedIndex && enemyCreeps.length > enemyIndex)
    {
        if(getRange(enemyCreeps[enemyIndex], myFlag) < getRange(rangedCreeps[0], myFlag) + 35)
        {
            defensive = true;
            console.log("retreating ranged" + enemyIndex); 
            if(flagDefended)
            {
                if(getRange(rangedCreeps[0], enemyCreeps[0]) > 2)
                {
                    console.log("attacking defensively");
                    rangedCreeps[0].moveTo(enemyCreeps[0]);
                }
                else
                {
                    rangedCreeps[0].moveTo(myFlag);
                }

                enemyCreeps.sort((a, b) => getRange(a, rangedCreeps[0]) - getRange(b, rangedCreeps[0]));  
                rangedCreeps[0].rangedAttack(enemyCreeps[0]);
                rangedCreeps.shift();
                enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));
                continue;
            }

            rangedCreeps[0].moveTo(myFlag);    
            
            enemyCreeps.sort((a, b) => getRange(a, rangedCreeps[0]) - getRange(b, rangedCreeps[0]));  
            rangedCreeps[0].rangedAttack(enemyCreeps[0]);
            if(getRange(rangedCreeps[0],myFlag) == 0)
            {
                flagDefended = true;
            }

            rangedCreeps.shift();
            
            enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag)); 
        }
        enemyIndex = enemyIndex + 1;
        rangedIndex = rangedIndex + 1;
    }

    
    var meleeIndex = 0;
    attackCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));
    while(attackCreeps.length > meleeIndex && enemyCreeps.length > enemyIndex)
    {
        if(getRange(enemyCreeps[enemyIndex], myFlag) < getRange(attackCreeps[0], myFlag) + 35)
        {
            defensive = true;
            console.log("retreating attack" + enemyIndex); 
            enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));  
            attackCreeps[0].moveTo(enemyCreeps[0]);    
            enemyCreeps.sort((a, b) => getRange(a, attackCreeps[0]) - getRange(b, attackCreeps[0]));  
            attackCreeps[0].attack(enemyCreeps[0]);
            attackCreeps.shift();
            
            enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag)); 
        }
        enemyIndex = enemyIndex + 1;
        meleeIndex = meleeIndex + 1;
    }

    if(enemyCreeps.length == 0)
    {
        defensive = false;
    }

    attackCreeps.forEach(creep => meleeAttacker(creep, enemyCreeps, enemyFlag, myFlag, healCreeps, myCreeps, defensive));
    rangedCreeps.forEach(creep => rangedAttacker(creep, enemyCreeps, myCreeps, healCreeps, myFlag. defensive));
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
    if(defensive)
    {
        enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));
        creep.moveTo(enemyCreeps[0]);  
        creep.attack(enemyCreeps[0]);   
        return;
    }
        
    if(creep.hits < creep.hitsMax && myHealers.length > 0 && getRange(myHealers[0], creep) < 15)
    {
        creep.moveTo(myHealers[0]);
        return;
    }

    var confidence = calculateConfidence(creep, myCreeps, enemyCreeps);

    if(confidence > 80 && creep.hits * 1.2 > creep.hitsMax)
    {        
        if(enemyCreeps.length > 0)
        {
            if(ERR_NOT_IN_RANGE == creep.attack(enemyCreeps[0]) && creep.hits == creep.hitsMax)
            {
                creep.moveTo(enemyCreeps[0]);
                return;
            }
        }

        creep.moveTo(enemyFlag);
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
            confidence = confidence + 30 - creepRange; 
        }
    }

    
    for(var enemyCreep of enemyCreeps)
    {
        var creepRange = getRange(enemyCreep, creep);
        if(creepRange < 30)
        {
            confidence = confidence - 30 + creepRange;
        }
    }

    return confidence;
}

function rangedAttacker(creep, enemyCreeps, myCreeps, myHealers, myFlag, defensive)
{    
    var inRange = creep.findInRange(enemyCreeps, 3).sort((a, b) => a.hits - b.hits);

    myHealers.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    
    if(defensive)
    {
        enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));
        creep.moveTo(enemyCreeps[0]);
        console.log("moving to enemy creep closest to flag");
    }

    enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));

    if(inRange.length > 0)
    {
        creep.rangedAttack(inRange[0]);   
        
        if(getRange(creep, inRange[0]) < 3)
        {
            if(myHealers.length > 0)
            {
                creep.moveTo(myHealers[0]);
            }
            else
            {
                creep.moveTo(myFlag);
            }
        }
        
        return;
    }

    if(creep.hits < creep.hitsMax)
    {
        if(myHealers.length > 0 && getRange(myHealers[0], creep) > 2)
        {
            creep.moveTo(myHealers[0]);
        }   
        else
        {
            creep.moveTo(myFlag);
        }
    }

    var confidence = calculateConfidence(creep, myCreeps, enemyCreeps);

    if(confidence > 80 && enemyCreeps.length > 0)
    {
        if(ERR_NOT_IN_RANGE == creep.rangedAttack(enemyCreeps[0]))
        {
            enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));
            if(enemyCreeps.length > 0)
            {
                creep.moveTo(enemyCreeps[0]);
            } 
            else
            {
                creep.moveTo(myFlag);
            }
        }
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

function healer(creep, myCreeps, meleeCreeps, myHealers, myFlag, enemyFlag, defensive)
{
    // Find nearest friendly creep
    var healableCreeps = myCreeps.filter(i => i.hits < i.hitsMax && i != creep).sort((a, b) => getRange(a, creep) - getRange(b, creep));
    var validHealers = myHealers.filter(i => i != creep).sort((a, b) => getRange(a, creep) - getRange(b, creep));

    if(creep.hits < creep.hitsMax * .7 && validHealers.length > 0)
    {
        creep.moveTo(myFlag);
        return;
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