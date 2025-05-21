// js/fbxViewer.js
import * as BABYLON from 'babylonjs';
import { createMergedChunkMesh } from '../voxel_engine/voxel-renderer.js';
import { initVoxelEditor } from '../voxel_engine/voxel-editor.js';
import { CHUNK_SIZE } from '../voxel_engine/voxel-data-declarations.js'; 
import * as WorldData from '../world_data.js'; 
// Note: voxel_engine/voxel-data.js calls resetChunkData(0,0,0) on its own load.

function showStatus(message, statusElementId = 'statusMessage') { // Ensure showStatus is available
    const statusElement = document.getElementById(statusElementId);
    if (statusElement) {
        statusElement.textContent = message;
    } else {
        console.log("Status Element not found:", statusElementId, "Message:", message);
    }
}

let displayedChunkMeshes = {}; // Key: "x,y,z", Value: BABYLON.Mesh

window.updateWorldView = function() {
    const allCoords = WorldData.getAllChunkCoordinates();
    const scene = window.scene; 

    if (!scene) {
        console.error("updateWorldView: Scene not available.");
        return;
    }
    
    console.log("Updating world view. Chunks in WorldData:", allCoords.map(c => `${c.x},${c.y},${c.z}`));

    // Set of current chunk keys for quick lookup
    const currentChunkKeys = new Set(allCoords.map(c => `${c.x},${c.y},${c.z}`));

    // Dispose meshes for chunks that are no longer in WorldData (if any)
    for (const oldChunkKey in displayedChunkMeshes) {
        if (!currentChunkKeys.has(oldChunkKey)) {
            if (displayedChunkMeshes[oldChunkKey]) {
                displayedChunkMeshes[oldChunkKey].dispose();
                delete displayedChunkMeshes[oldChunkKey];
                console.log(`Disposed mesh for removed chunk ${oldChunkKey}`);
            }
        }
    }
    
    allCoords.forEach(coords => {
        const chunkKey = `${coords.x},${coords.y},${coords.z}`;
        const chunkDataExists = WorldData.getChunkData(coords.x, coords.y, coords.z);

        if (!chunkDataExists) { 
            console.warn(`No data for chunk ${chunkKey} during view update (should have been caught by getAllChunkCoordinates).`);
            return;
        }

        // If a mesh for this chunk already exists, dispose of it before creating a new one
        // This ensures chunk is visually up-to-date if its data changed.
        if (displayedChunkMeshes[chunkKey]) {
            displayedChunkMeshes[chunkKey].dispose();
            // console.log(`Disposed old mesh for chunk ${chunkKey} before update.`);
        }

        const newChunkMesh = createMergedChunkMesh(scene, coords.x, coords.y, coords.z);
        if (newChunkMesh) {
            const basePosition = window.theVoxelChunkOriginalPosition || new BABYLON.Vector3(-(CHUNK_SIZE / 2), 0, -(CHUNK_SIZE / 2));
            newChunkMesh.position = basePosition.add(
                new BABYLON.Vector3(coords.x * CHUNK_SIZE, coords.y * CHUNK_SIZE, coords.z * CHUNK_SIZE)
            );
            displayedChunkMeshes[chunkKey] = newChunkMesh;
            // console.log(`Created/updated mesh for chunk ${chunkKey} at world pos`, newChunkMesh.position);

            if (coords.x === 0 && coords.y === 0 && coords.z === 0) { // Active editing chunk
                window.theVoxelChunk = newChunkMesh; 
                if (window.currentAppliedVoxelMaterial && window.theVoxelChunk.material !== window.currentAppliedVoxelMaterial) {
                    if (window.theVoxelChunk.name && !window.theVoxelChunk.name.startsWith("empty_chunk")) {
                         window.theVoxelChunk.material = window.currentAppliedVoxelMaterial;
                    }
                }
            }
        }
    });
    console.log("World view update complete. Displayed chunks:", Object.keys(displayedChunkMeshes));
}

function createBasicScene(engine, canvas) { // Renamed to avoid conflict if global createScene exists
    let scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.2, 0.25, 0.3, 1);
    var camera = new BABYLON.ArcRotateCamera("camera1", -Math.PI / 2 + (Math.PI/4), Math.PI / 4, 40, 
        new BABYLON.Vector3(CHUNK_SIZE/2, CHUNK_SIZE/4, CHUNK_SIZE/2), // Target center of initial chunk
        scene);
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 20; 
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 200;
    var light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0.5, 1, 0.25), scene);
    light.intensity = 0.8;
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(CHUNK_SIZE/2, CHUNK_SIZE*2, CHUNK_SIZE/2), scene);
    light2.intensity = 0.5;
    return scene;
}

export async function initViewer(canvasId, dropZoneElement, statusElementId) {
    const canvas = document.getElementById(canvasId);
    const engine = new BABYLON.Engine(canvas, true);
    BABYLON.SceneLoader.ShowLoadingScreen = false;

    var sceneInstance = createBasicScene(engine, canvas);
    window.scene = sceneInstance;

    window.theVoxelChunkOriginalPosition = new BABYLON.Vector3(-(CHUNK_SIZE / 2), 0, -(CHUNK_SIZE / 2));
    
    window.updateWorldView(); 

    if (displayedChunkMeshes["0,0,0"]) {
        window.theVoxelChunk = displayedChunkMeshes["0,0,0"];
        showStatus('Voxel chunk (0,0,0) loaded. Editor initialized.');
    } else {
        showStatus('Failed to create initial voxel chunk (0,0,0). Editor might not work correctly.');
        window.theVoxelChunk = new BABYLON.Mesh("dummyActiveChunk", window.scene); // Fallback
    }
    
    initVoxelEditor(window.scene); 
    
    engine.runRenderLoop(() => {
        if (window.scene) window.scene.render();
    });
    window.addEventListener('resize', () => engine.resize());
    
    return sceneInstance;
}
