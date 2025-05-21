// voxel_engine/voxel-data.js
import * as WorldData from '../world_data.js';
import { CHUNK_SIZE, defaultBlockColors } from './voxel-data-declarations.js';

// CHUNK_SIZE and defaultBlockColors are now imported

export function setBlock(chunkX, chunkY, chunkZ, localX, localY, localZ, blockType, color = null) {
    const currentChunkData = WorldData.getOrCreateChunkData(chunkX, chunkY, chunkZ);
    // No early return here, getOrCreateChunkData always returns a chunk

    if (localX >= 0 && localX < CHUNK_SIZE &&
        localY >= 0 && localY < CHUNK_SIZE &&
        localZ >= 0 && localZ < CHUNK_SIZE) {
        if (blockType === 0) {
            currentChunkData[localX][localY][localZ] = 0; // Air
        } else {
            let blockData = { type: blockType };
            if (color) {
                blockData.color = color;
            } else if (defaultBlockColors[blockType]) {
                blockData.color = defaultBlockColors[blockType];
            }
            currentChunkData[localX][localY][localZ] = blockData;
        }
    } else {
        console.warn(`SetBlock: Local coordinates (${localX},${localY},${localZ}) out of bounds for chunk (${chunkX},${chunkY},${chunkZ})`);
    }
}

export function getBlock(chunkX, chunkY, chunkZ, localX, localY, localZ) {
    const currentChunkData = WorldData.getChunkData(chunkX, chunkY, chunkZ);
    if (!currentChunkData) return 0; 

    if (localX >= 0 && localX < CHUNK_SIZE &&
        localY >= 0 && localY < CHUNK_SIZE &&
        localZ >= 0 && localZ < CHUNK_SIZE) {
        return currentChunkData[localX][localY][localZ]; 
    }
    return 0; 
}

export function getBlockType(chunkX, chunkY, chunkZ, localX, localY, localZ) {
    const block = getBlock(chunkX, chunkY, chunkZ, localX, localY, localZ);
    return block ? block.type : 0;
}

export function getBlockColor(chunkX, chunkY, chunkZ, localX, localY, localZ) {
    const block = getBlock(chunkX, chunkY, chunkZ, localX, localY, localZ);
    return block && block.color ? block.color : null;
}

export function getChunkDataCopyForUndo(chunkX, chunkY, chunkZ) {
    const currentChunkData = WorldData.getChunkData(chunkX, chunkY, chunkZ);
    if (!currentChunkData) {
        console.warn(`getChunkDataCopyForUndo: No chunk data found for ${chunkX},${chunkY},${chunkZ}`);
        return null;
    }
    return JSON.parse(JSON.stringify(currentChunkData));
}

export function setChunkDataFromCopyForUndo(chunkX, chunkY, chunkZ, dataCopy) {
    if (!WorldData.getChunkData(chunkX, chunkY, chunkZ)) {
        console.error(`setChunkDataFromCopyForUndo: Target chunk ${chunkX},${chunkY},${chunkZ} does not exist. Cannot restore.`);
        return; 
    }
    if (dataCopy && Array.isArray(dataCopy) && dataCopy.length === CHUNK_SIZE &&
        Array.isArray(dataCopy[0]) && dataCopy[0].length === CHUNK_SIZE &&
        Array.isArray(dataCopy[0][0]) && dataCopy[0][0].length === CHUNK_SIZE) {
        WorldData.setChunkData(chunkX, chunkY, chunkZ, JSON.parse(JSON.stringify(dataCopy)));
    } else {
        console.error("Invalid dataCopy provided to setChunkDataFromCopyForUndo for chunk:", chunkX, chunkY, chunkZ);
    }
}

export function resetChunkData(chunkX, chunkY, chunkZ) {
    WorldData.ensureChunk(chunkX, chunkY, chunkZ); // Ensure it exists
    const targetChunkData = WorldData.getChunkData(chunkX, chunkY, chunkZ);
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                targetChunkData[x][y][z] = 0;
            }
        }
    }
    setBlock(chunkX, chunkY, chunkZ, 0, 0, 0, 1); 
    setBlock(chunkX, chunkY, chunkZ, 1, 0, 0, 2); 
    setBlock(chunkX, chunkY, chunkZ, 0, 1, 0, 3); 
    setBlock(chunkX, chunkY, chunkZ, 1, 1, 0, 1, [0.9, 0.9, 0.1]); 
    setBlock(chunkX, chunkY, chunkZ, 2, 1, 0, 4); 
    console.log(`Chunk ${chunkX},${chunkY},${chunkZ} reset to default blocks.`);
}

// Initialize the (0,0,0) chunk on load.
resetChunkData(0,0,0);
