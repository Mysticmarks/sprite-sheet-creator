// procedural_generator/basic-generator.js
import { CHUNK_SIZE, defaultBlockColors } from '../voxel_engine/voxel-data-declarations.js';

export function generateSimpleChunkData(chunkX, chunkY, chunkZ) {
    const newChunkData = new Array(CHUNK_SIZE).fill(0).map(() =>
        new Array(CHUNK_SIZE).fill(0).map(() =>
            new Array(CHUNK_SIZE).fill(0)
        )
    );

    if (chunkY === 0) { // Ground level chunks
        const groundBlockType = 1; 
        const groundBlock = { type: groundBlockType, color: defaultBlockColors[groundBlockType] || [0.5,0.5,0.5] };
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                newChunkData[x][0][z] = groundBlock; 
            }
        }

        const randomBlockType = 2; 
        const randomBlock = { type: randomBlockType, color: defaultBlockColors[randomBlockType] || [0.6,0.6,0.6] };
        const numRandomBlocks = Math.floor(CHUNK_SIZE * CHUNK_SIZE * 0.1); 

        for (let i = 0; i < numRandomBlocks; i++) {
            let rx = Math.floor(Math.random() * CHUNK_SIZE);
            let rz = Math.floor(Math.random() * CHUNK_SIZE);
            let ry = Math.floor(Math.random() * (CHUNK_SIZE / 4)) + 1; 
            if (ry < CHUNK_SIZE) { 
                newChunkData[rx][ry][rz] = randomBlock;
            }
        }
    } else if (chunkY < 0) { // Below ground
        const earthBlockType = 3; 
        const earthBlock = { type: earthBlockType, color: defaultBlockColors[earthBlockType] || [0.4,0.3,0.2] };
         for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_SIZE; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    newChunkData[x][y][z] = earthBlock; 
                }
            }
        }
    }
    // Chunks with chunkY > 0 will be empty (all air)

    console.log(`Generated simple chunk data for chunk coordinates: (${chunkX},${chunkY},${chunkZ})`);
    return newChunkData;
}
