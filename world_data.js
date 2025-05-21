// world_data.js
import { CHUNK_SIZE } from './voxel_engine/voxel-data-declarations.js'; // Placeholder for CHUNK_SIZE

let worldChunks = {}; // Key: "x,y,z", Value: chunkData 3D array

function getChunkKey(chunkX, chunkY, chunkZ) {
    return `${chunkX},${chunkY},${chunkZ}`;
}

export function ensureChunk(chunkX, chunkY, chunkZ) {
    const key = getChunkKey(chunkX, chunkY, chunkZ);
    if (!worldChunks[key]) {
        const newChunkData = new Array(CHUNK_SIZE).fill(0).map(() =>
            new Array(CHUNK_SIZE).fill(0).map(() =>
                new Array(CHUNK_SIZE).fill(0)
            )
        );
        worldChunks[key] = newChunkData;
        console.log(`Created new empty chunk at ${key}`);
    }
    return worldChunks[key];
}

export function getChunkData(chunkX, chunkY, chunkZ) {
    const key = getChunkKey(chunkX, chunkY, chunkZ);
    return worldChunks[key]; 
}

export function getOrCreateChunkData(chunkX, chunkY, chunkZ) {
    return ensureChunk(chunkX, chunkY, chunkZ);
}

export function setChunkData(chunkX, chunkY, chunkZ, data) {
    const key = getChunkKey(chunkX, chunkY, chunkZ);
    if (data && Array.isArray(data) && data.length === CHUNK_SIZE &&
        Array.isArray(data[0]) && data[0].length === CHUNK_SIZE &&
        Array.isArray(data[0][0]) && data[0][0].length === CHUNK_SIZE) {
        worldChunks[key] = data; // data should be a fresh copy if coming from elsewhere
    } else {
        console.error("Invalid chunk data provided to setChunkData for key:", key, data);
    }
}

export function getAllChunkCoordinates() {
    return Object.keys(worldChunks).map(key => {
        const parts = key.split(',');
        return { x: parseInt(parts[0]), y: parseInt(parts[1]), z: parseInt(parts[2]) };
    });
}

export function clearAllChunks() { // For testing or full reset
    worldChunks = {};
    console.log("All chunks cleared from world_data.");
}
