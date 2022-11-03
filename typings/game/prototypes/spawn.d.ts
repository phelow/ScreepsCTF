declare module "game/prototypes" {
    import {
        ERR_NOT_OWNER, ERR_BUSY, ERR_INVALID_ARGS, ERR_NOT_ENOUGH_ENERGY
    } from "game/constants";

    /** {@link createConstructionSite} call result*/
    export interface SpawnCreepResult {
        /** the instance of the {@link Creep} being spawned */
        object?: Creep | undefined;

        /** the error code */
        error?: typeof ERR_NOT_OWNER | typeof ERR_INVALID_ARGS | typeof ERR_NOT_ENOUGH_ENERGY | typeof ERR_BUSY | undefined;
    }

    /** This structure can create creeps. It also auto-regenerate a little amount of energy each tick */
    export class StructureSpawn extends OwnedStructure {
        /** A {@link Store} object that contains cargo of this structure */
        store: Store;

        /**
         * Start the creep spawning process
         * @param body An array describing the new creep’s body
         * @returns a {@link SpawnCreepResult} object with the call result
         */
        spawnCreep(body: BodyPartType[]): SpawnCreepResult;
    }
}
