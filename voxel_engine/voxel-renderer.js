// voxel_engine/voxel-renderer.js
import * as BABYLON from 'babylonjs';
import { getBlock } from './voxel-data.js'; 
import { CHUNK_SIZE, defaultBlockColors } from './voxel-data-declarations.js';

let localColorMaterialCache = {}; 
let defaultMaterialInstance;

function ensureDefaultMaterial(scene) {
    if (!defaultMaterialInstance || defaultMaterialInstance.isDisposed()) {
        defaultMaterialInstance = new BABYLON.StandardMaterial("defaultVoxelMatGreedy", scene);
        defaultMaterialInstance.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
        defaultMaterialInstance.backFaceCulling = true;
    }
}

// This function decides the material for a given voxel's data
function getMaterialForVoxel(scene, blockData) {
    ensureDefaultMaterial(scene);
    if (!blockData || blockData === 0) return defaultMaterialInstance; // Should be called for solid blocks

    const blockType = blockData.type;

    // Priority 1: LLM-generated texture for this specific block type
    if (window.blockTypeTextureURLs && window.blockTypeTextureURLs[blockType]) {
        const textureUrl = window.blockTypeTextureURLs[blockType];
        // Use a global cache for Babylon materials created from these texture URLs
        if (!window.blockTypeMaterialsCache) window.blockTypeMaterialsCache = {}; 
        
        const materialCacheKey = `type_${blockType}_tex_${textureUrl}`; // Key includes URL

        if (window.blockTypeMaterialsCache[materialCacheKey] && !window.blockTypeMaterialsCache[materialCacheKey].isDisposed()) {
            return window.blockTypeMaterialsCache[materialCacheKey];
        }

        // console.log(`Creating new textured material for Type ${blockType} using URL: ${textureUrl.substring(0, 60)}...`);
        const texturedMaterial = new BABYLON.StandardMaterial(materialCacheKey, scene);
        const texture = new BABYLON.Texture(textureUrl, scene,
            false, // noMipmap
            true,  // invertY (BabylonJS default)
            BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
            () => { // onLoad
                // console.log(`Texture loaded successfully for Type ${blockType}: ${textureUrl}`);
            },
            (message, exception) => { // onError
                console.error(`Failed to load texture for Type ${blockType} from URL: ${textureUrl}`, message, exception);
                if(window.blockTypeTextureURLs) delete window.blockTypeTextureURLs[blockType];
                if(window.blockTypeMaterialsCache && window.blockTypeMaterialsCache[materialCacheKey]) {
                    window.blockTypeMaterialsCache[materialCacheKey].dispose();
                    delete window.blockTypeMaterialsCache[materialCacheKey];
                }
                if(window.updateWorldView) window.updateWorldView(); 
            }
        );
        texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE; 
        texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
        texturedMaterial.diffuseTexture = texture;
        texturedMaterial.backFaceCulling = true;
        
        window.blockTypeMaterialsCache[materialCacheKey] = texturedMaterial;
        return texturedMaterial;
    }

    // Priority 2: Block's own baked-in color (blockData.color)
    let colorToUse;
    let colorSource = ""; 
    if (blockData.color) {
        colorToUse = blockData.color;
        colorSource = "custom";
    } else if (blockType && defaultBlockColors[blockType]) { // Priority 3: Default color for the block type
        colorToUse = defaultBlockColors[blockType];
        colorSource = "default";
    } else { // Priority 4: Global default material
        return defaultMaterialInstance;
    }
    
    const localCacheKey = `type_${blockType}_${colorSource}_${colorToUse.join(',')}`;
    if (!localColorMaterialCache[localCacheKey] || localColorMaterialCache[localCacheKey].isDisposed()) {
        const colorMaterial = new BABYLON.StandardMaterial(localCacheKey, scene);
        colorMaterial.diffuseColor = new BABYLON.Color3(colorToUse[0], colorToUse[1], colorToUse[2]);
        colorMaterial.backFaceCulling = true;
        localColorMaterialCache[localCacheKey] = colorMaterial;
    }
    return localColorMaterialCache[localCacheKey];
}
    
export function createMergedChunkMesh(scene, chunkX, chunkY, chunkZ) {
    ensureDefaultMaterial(scene);
    localColorMaterialCache = {}; 

    const allQuadsData = []; 
    for (let d = 0; d < 3; ++d) {
        const u = (d + 1) % 3; const v = (d + 2) % 3;
        const x = [0, 0, 0]; const q = [0, 0, 0];
        const mask = new Array(CHUNK_SIZE * CHUNK_SIZE); 
        for (let side = 0; side < 2; ++side) {
            q[d] = side === 0 ? 1 : -1; 
            for (x[d] = 0; x[d] < CHUNK_SIZE; ++x[d]) {
                let n = 0; 
                for (x[v] = 0; x[v] < CHUNK_SIZE; ++x[v]) {
                    for (x[u] = 0; x[u] < CHUNK_SIZE; ++x[u]) {
                        const blockCurrent = getBlock(chunkX, chunkY, chunkZ, x[0], x[1], x[2]);
                        const blockAheadCoords = [x[0] + q[0], x[1] + q[1], x[2] + q[2]];
                        let blockAhead = 0; 
                        if (blockAheadCoords[d] >= 0 && blockAheadCoords[d] < CHUNK_SIZE) {
                             blockAhead = getBlock(chunkX, chunkY, chunkZ, blockAheadCoords[0], blockAheadCoords[1], blockAheadCoords[2]);
                        }
                        const currentIsSolid = blockCurrent !== 0;
                        const aheadIsSolid = blockAhead !== 0;
                        let visibleFace = false;
                        if (currentIsSolid) {
                            if (side === 0) { 
                                if (x[d] === CHUNK_SIZE - 1 || !aheadIsSolid) { visibleFace = true; }
                            } else { 
                                 if (x[d] === 0 || !aheadIsSolid) { visibleFace = true; }
                            }
                        }
                        mask[n++] = visibleFace ? blockCurrent : 0; 
                    }
                }
                n = 0;
                for (let j = 0; j < CHUNK_SIZE; ++j) {
                    for (let i = 0; i < CHUNK_SIZE;) {
                        const currentMaskBlockData = mask[n];
                        if (currentMaskBlockData) { 
                            let w, h;
                            for (w = 1; i + w < CHUNK_SIZE && mask[n + w] && JSON.stringify(mask[n+w]) === JSON.stringify(currentMaskBlockData) ; ++w);
                            let done = false;
                            for (h = 1; j + h < CHUNK_SIZE; ++h) {
                                for (let k = 0; k < w; ++k) {
                                    if (!mask[n + k + h * CHUNK_SIZE] || JSON.stringify(mask[n + k + h * CHUNK_SIZE]) !== JSON.stringify(currentMaskBlockData)) {
                                        done = true; break;
                                    }
                                }
                                if (done) break;
                            }
                            const quadStartPos = [0,0,0]; quadStartPos[d] = x[d] + (side === 0 ? 1 : 0); 
                            quadStartPos[u] = i; quadStartPos[v] = j;
                            const du = [0,0,0]; du[u] = w; const dv = [0,0,0]; dv[v] = h;
                            const positions = side === 0 ? 
                                [ quadStartPos[0], quadStartPos[1], quadStartPos[2], quadStartPos[0] + dv[0], quadStartPos[1] + dv[1], quadStartPos[2] + dv[2], quadStartPos[0] + dv[0] + du[0], quadStartPos[1] + dv[1] + du[1], quadStartPos[2] + dv[2] + du[2], quadStartPos[0] + du[0], quadStartPos[1] + du[1], quadStartPos[2] + du[2] ] : 
                                [ quadStartPos[0], quadStartPos[1], quadStartPos[2], quadStartPos[0] + du[0], quadStartPos[1] + du[1], quadStartPos[2] + du[2], quadStartPos[0] + du[0] + dv[0], quadStartPos[1] + du[1] + dv[1], quadStartPos[2] + du[2] + dv[2], quadStartPos[0] + dv[0], quadStartPos[1] + dv[1], quadStartPos[2] + dv[2] ];
                            const uvs = [0,0, 1,0, 1,1, 0,1]; 
                            const indices = side === 0 ? [0,1,2, 0,2,3] : [0,2,1, 0,3,2];
                            
                            allQuadsData.push({ positions, indices, uvs, material: getMaterialForVoxel(scene, currentMaskBlockData) }); // <<< MATERIAL LOGIC CHANGED HERE

                            for (let l = 0; l < h; ++l) for (let k = 0; k < w; ++k) mask[n + k + l * CHUNK_SIZE] = 0;
                            i += w; n += w;
                        } else { i++; n++; }
                    }
                }
            }
        }
    } // --- End of greedy mesher core loops ---

    if (allQuadsData.length === 0) { 
        const emptyNode = new BABYLON.Mesh(`empty_greedy_chunk_${chunkX}_${chunkY}_${chunkZ}`, scene);
        emptyNode.isPickable = false; return emptyNode;
    }
    const meshesToMerge = [];
    allQuadsData.forEach((quadData, idx) => { 
        let customMesh = new BABYLON.Mesh(`greedy_quad_${chunkX}_${chunkY}_${chunkZ}_${idx}`, scene);
        let vertexData = new BABYLON.VertexData();
        vertexData.positions = quadData.positions; vertexData.indices = quadData.indices; vertexData.uvs = quadData.uvs;
        BABYLON.VertexData.ComputeNormals(quadData.positions, quadData.indices, vertexData.normals);
        vertexData.applyToMesh(customMesh); customMesh.material = quadData.material;
        meshesToMerge.push(customMesh);
    });
    const mergedMesh = BABYLON.Mesh.MergeMeshes(meshesToMerge, true, true, undefined, true, true);
    if (mergedMesh) { mergedMesh.name = `greedy_merged_chunk_${chunkX}_${chunkY}_${chunkZ}`; }
    else { 
        console.warn("Greedy MergeMeshes returned null for chunk", chunkX, chunkY, chunkZ);
        const fallbackNode = new BABYLON.Mesh(`fallback_greedy_chunk_${chunkX}_${chunkY}_${chunkZ}`, scene);
        fallbackNode.isPickable = false; return fallbackNode;
    }
    return mergedMesh;
}
