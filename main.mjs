import { ATTACK, HEAL, RANGED_ATTACK, ERR_NOT_IN_RANGE } from "game/constants";
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
    myCreeps.forEach(creep => {
        if(creep.hits < creep.hitsMax * .8)
        {
            defensive = true;
        }

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
        if(creep.hits < creep.hitsMax/healCoef && healCreeps.length > 0 && getRange(attackCreeps[0], myFlag) > 3)
        {
            enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
            healCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));

            if(creep.hits < creep.hitsMax * .7)
            {
                defensive = true;
                if(healCreeps.length > 0 && getRange(healCreeps[0], creep) > 2)
                {
                    creep.moveTo(healCreeps[0]);
                }   
                else
                {
                    creep.moveTo(myFlag);
                }
            }
            creep.attack(enemyCreeps[0]);
            attackCreeps.shift();
            break;
        }
    }

    
    enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));  
    rangedCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag));
    var enemyRangeToFlag = 1000;
    if(enemyCreeps.length > 0)
    {
        enemyRangeToFlag = getRange(enemyCreeps[0], myFlag);
    
    }
    defensive = defensive | rangedCreeps.length > 0 && enemyCreeps.length > 0 && enemyRangeToFlag < getRange(rangedCreeps[0], myFlag); 
    if(defensive)
    {
        var index = 0;
        while(rangedCreeps.length > index && enemyCreeps.length > index && getRange(enemyCreeps[index], myFlag) < getRange(rangedCreeps[index], myFlag) + 2)
        {
            console.log("retreating " + index); 
            rangedCreeps[0].moveTo(myFlag);    
            
            enemyCreeps.sort((a, b) => getRange(a, rangedCreeps[0]) - getRange(b, rangedCreeps[0]));  
            rangedCreeps[0].rangedAttack(enemyCreeps[0]);
            rangedCreeps.shift();
            
            enemyCreeps.sort((a, b) => getRange(a, myFlag) - getRange(b, myFlag)); 
            index = index + 1;
        }
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
    rangedCreeps.forEach(creep => rangedAttacker(creep, enemyCreeps, attackCreeps, healCreeps, myFlag. defensive));
    healCreeps.forEach(creep => healer(creep, myCreeps, healCreeps, myFlag, enemyFlag, defensive));

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
    if(enemyCreeps.length > 0)
    {
        if(ERR_NOT_IN_RANGE == creep.attack(enemyCreeps[0]) && creep.hits == creep.hitsMax)
        {
            creep.moveTo(enemyCreeps[0]);
            return;
        }
    }
    
    if(creep.hits < creep.hitsMax && myHealers.length > 0 && getRange(myHealers[0], creep) < 15)
    {
        creep.moveTo(myHealers[0]);
        return;
    }
    
    if (defensive)
    {
        creep.moveTo(myFlag);
    }
    else
    {
        creep.moveTo(enemyFlag);
    }
}

function rangedAttacker(creep, enemyCreeps, myCreeps, myHealers, myFlag, defensive)
{    
    var inRange = creep.findInRange(enemyCreeps, 3).sort((a, b) => a.hits - b.hits);

    enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
    myHealers.sort((a, b) => getRange(a, creep) - getRange(b, creep));

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

    if(defensive)
    {
        creep.moveTo(myFlag);
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

function healer(creep, myCreeps, myHealers, myFlag, enemyFlag, defensive)
{
    // Find nearest friendly creep
    var healableCreeps = myCreeps.filter(i => i.hits < i.hitsMax && i != creep).sort((a, b) => getRange(a, creep) - getRange(b, creep));
    var validHealers = myHealers.filter(i => i != creep).sort((a, b) => getRange(a, creep) - getRange(b, creep));
    if(healableCreeps.length > 0)
    {
        creep.heal(healableCreeps[0]);
        creep.rangedHeal(healableCreeps[0]);
        creep.moveTo(healableCreeps[0]);
        return;
    }

    if(creep.hits < creep.hitsMax * .7 && validHealers.length > 0)
    {
        creep.moveTo(validHealers[0]);
    }

    if (defensive)
    {
        creep.moveTo(myFlag);
    }
    else
    {
        creep.moveTo(enemyFlag);
    }
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
    
    
    if(tower.energy < tower.energyCapacity)
    {
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