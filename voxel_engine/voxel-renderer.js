// voxel_engine/voxel-renderer.js
import * as BABYLON from 'babylonjs';
import { getBlock } from './voxel-data.js'; 
import { CHUNK_SIZE } from './voxel-data-declarations.js';

let materialCache = {}; 
let defaultMaterialInstance;

function ensureDefaultMaterial(scene) {
    if (!defaultMaterialInstance || defaultMaterialInstance.isDisposed()) {
        defaultMaterialInstance = new BABYLON.StandardMaterial("defaultVoxelMat", scene);
        defaultMaterialInstance.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7); // Default grey
    }
}

export function createMergedChunkMesh(scene, chunkX, chunkY, chunkZ) {
    ensureDefaultMaterial(scene);
    materialCache = {}; // Reset cache for this specific chunk generation

    const meshesToMerge = [];

    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
        for (let localY = 0; localY < CHUNK_SIZE; localY++) {
            for (let localZ = 0; localZ < CHUNK_SIZE; localZ++) {
                const blockData = getBlock(chunkX, chunkY, chunkZ, localX, localY, localZ);
                if (blockData !== 0) { 
                    const voxelMesh = BABYLON.MeshBuilder.CreateBox(`voxel_${localX}_${localY}_${localZ}`, { size: 1 }, scene);
                    voxelMesh.position = new BABYLON.Vector3(localX + 0.5, localY + 0.5, localZ + 0.5);
                    
                    let materialToUse = defaultMaterialInstance;
                    if (blockData.color) {
                        const colorKey = blockData.color.join(',');
                        if (!materialCache[colorKey]) {
                            const colorMaterial = new BABYLON.StandardMaterial(`mat_chunk_${chunkX}_${chunkY}_${chunkZ}_${colorKey}`, scene);
                            colorMaterial.diffuseColor = new BABYLON.Color3(blockData.color[0], blockData.color[1], blockData.color[2]);
                            materialCache[colorKey] = colorMaterial;
                        }
                        materialToUse = materialCache[colorKey];
                    }
                    voxelMesh.material = materialToUse;
                    meshesToMerge.push(voxelMesh);
                }
            }
        }
    }

    if (meshesToMerge.length === 0) {
        const emptyChunkNode = new BABYLON.Mesh(`empty_chunk_${chunkX}_${chunkY}_${chunkZ}`, scene);
        emptyChunkNode.isPickable = false; // Not pickable if empty
        return emptyChunkNode; 
    }

    const mergedMesh = BABYLON.Mesh.MergeMeshes(meshesToMerge, true, true, undefined, true, true); 
    if (mergedMesh) {
        mergedMesh.name = `merged_voxel_chunk_${chunkX}_${chunkY}_${chunkZ}`;
    } else {
        // This case should ideally not be hit if meshesToMerge is not empty.
        // If it is, create an empty node as a fallback.
        console.warn("MergeMeshes returned null unexpectedly for chunk", chunkX, chunkY, chunkZ);
        const fallbackNode = new BABYLON.Mesh(`fallback_chunk_${chunkX}_${chunkY}_${chunkZ}`, scene);
        fallbackNode.isPickable = false;
        return fallbackNode;
    }
    return mergedMesh;
}

// Placeholder for exportVoxelMeshToGLB if it were here.
// For now, assuming it's handled elsewhere or not critical for this refactor.
// export function exportVoxelMeshToGLB(scene, meshToExport, fileName) { ... }
