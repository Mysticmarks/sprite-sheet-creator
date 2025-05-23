// procedural_generator/basic-generator.js
import { CHUNK_SIZE, defaultBlockColors } from '../voxel_engine/voxel-data-declarations.js';

function simpleNoise2D(x, z, scale, amplitude) {
    if (scale <= 0) scale = 1; // Prevent division by zero or negative scale
    let val = 0;
    // Multiple sine waves for more variation
    val += Math.sin(x / scale + z / (scale * 1.5)) * Math.cos(z / (scale * 0.8) + x / (scale * 1.2));
    val += Math.sin((x + 100) / (scale * 1.5)) * Math.cos((z + 100) / (scale * 1.2));
    val += Math.sin((x - 200) / (scale * 0.5)) * Math.cos((z - 200) / (scale * 0.4));
    // Normalize roughly to -1 to 1 by dividing by expected max sum of amplitudes (approx 3 here)
    // This is a very rough normalization for this specific combination of sines/cosines.
    return (val / 3) * amplitude; 
}

export function generateSimpleChunkData(chunkX, chunkY, chunkZ, config = {}) {
    const {
        noiseScale = 32, 
        noiseAmplitude = 5, 
        baseHeight = 1  
    } = config;

    const newChunkData = new Array(CHUNK_SIZE).fill(0).map(() =>
        new Array(CHUNK_SIZE).fill(0).map(() =>
            new Array(CHUNK_SIZE).fill(0)
        )
    );

    if (chunkY === 0) { // Ground level chunks - generate terrain
        const groundBlockType = 1; 
        const groundBlock = { type: groundBlockType, color: defaultBlockColors[groundBlockType] || [0.5,0.5,0.5] };
        const grassBlockType = 2; 
        const grassBlock = { type: grassBlockType, color: defaultBlockColors[grassBlockType] || [0.2,0.6,0.2] };

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const worldX = chunkX * CHUNK_SIZE + x;
                const worldZ = chunkZ * CHUNK_SIZE + z;
                
                let heightOffset = Math.floor(simpleNoise2D(worldX, worldZ, noiseScale, noiseAmplitude));
                let currentTerrainHeight = baseHeight + heightOffset;
                
                // Clamp height to be within chunk boundaries (0 to CHUNK_SIZE-1)
                // currentTerrainHeight is the y-coordinate of the topmost block (grass)
                currentTerrainHeight = Math.max(0, Math.min(currentTerrainHeight, CHUNK_SIZE - 1));

                for (let y = 0; y < currentTerrainHeight; y++) { // Fill up to one below grass
                    newChunkData[x][y][z] = groundBlock;
                }
                // Place grass block on top if terrain has some height
                if (currentTerrainHeight >= 0 && currentTerrainHeight < CHUNK_SIZE) { 
                     newChunkData[x][currentTerrainHeight][z] = grassBlock;
                }
            }
        }
    } else if (chunkY < 0) { 
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
    console.log(`Generated chunk (${chunkX},${chunkY},${chunkZ}) with noise: Scale=${noiseScale}, Amp=${noiseAmplitude}, BaseH=${baseHeight}`);
    return newChunkData;
}
