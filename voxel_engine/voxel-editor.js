// voxel_engine/voxel-editor.js
import * as BABYLON from 'babylonjs';
import { CHUNK_SIZE } from './voxel-data-declarations.js';
import { setBlock, getBlock, getBlockType, getChunkDataCopyForUndo, setChunkDataFromCopyForUndo } from './voxel-data.js';
import { createMergedChunkMesh } from './voxel-renderer.js';

let sceneRef;
let groundPlane; 
let activeChunkCoords = { x: 0, y: 0, z: 0 }; // Default active chunk for editing

const MAX_UNDO_STEPS = 20;
let undoStack = [];

function saveUndoState() {
    if (undoStack.length >= MAX_UNDO_STEPS) {
        undoStack.shift(); 
    }
    const chunkDataToSave = getChunkDataCopyForUndo(activeChunkCoords.x, activeChunkCoords.y, activeChunkCoords.z);
    if (chunkDataToSave) {
        undoStack.push(chunkDataToSave);
    } else {
        console.warn("Failed to save undo state: no data for active chunk", activeChunkCoords);
    }
    const undoBtn = document.getElementById('undoEditBtn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
}

export function undoLastEdit() {
    if (undoStack.length > 0) {
        const previousState = undoStack.pop();
        setChunkDataFromCopyForUndo(activeChunkCoords.x, activeChunkCoords.y, activeChunkCoords.z, previousState);
        regenerateActiveChunkMesh(); 
        console.log("Undo performed for chunk", activeChunkCoords, ". States left:", undoStack.length);
        const undoBtn = document.getElementById('undoEditBtn');
        if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    } else {
        console.log("Undo stack empty.");
    }
}

function worldToVoxelLocalCoords(worldX, worldY, worldZ, chunkCurrentWorldPosition) {
    const localX = worldX - chunkCurrentWorldPosition.x;
    const localY = worldY - chunkCurrentWorldPosition.y;
    const localZ = worldZ - chunkCurrentWorldPosition.z;
    return {
        x: Math.floor(localX),
        y: Math.floor(localY),
        z: Math.floor(localZ)
    };
}

export function initVoxelEditor(babylonScene) {
    sceneRef = babylonScene;
    
    // window.theVoxelChunkOriginalPosition is world pos of chunk (0,0,0)
    const baseChunkWorldPos = window.theVoxelChunkOriginalPosition || new BABYLON.Vector3(0,0,0);
    
    // Ground plane is always relative to chunk (0,0,0)'s base for now
    const groundYPosition = baseChunkWorldPos.y - 0.5; 
    const groundXPosition = baseChunkWorldPos.x + CHUNK_SIZE / 2 - 0.5;
    const groundZPosition = baseChunkWorldPos.z + CHUNK_SIZE / 2 - 0.5;

    groundPlane = BABYLON.MeshBuilder.CreateGround("voxelEditGround", { width: CHUNK_SIZE * 3, height: CHUNK_SIZE * 3 }, sceneRef); // Larger ground
    groundPlane.position = new BABYLON.Vector3(groundXPosition, groundYPosition, groundZPosition); // Centered with chunk 0,0,0
    groundPlane.visibility = 0.0; 
    groundPlane.isPickable = true;
    groundPlane.enablePointerMoveEvents = false;

    const undoBtn = document.getElementById('undoEditBtn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;

    sceneRef.onPointerDown = (evt, pickInfo) => {
        if (!pickInfo.hit || !pickInfo.pickedPoint) return;

        let clickedMesh = pickInfo.pickedMesh;
        let isRightClick = evt.button === 2;
        
        // Calculate the world origin of the currently active editing chunk
        let activeChunkWorldOrigin = baseChunkWorldPos.add(
            new BABYLON.Vector3(activeChunkCoords.x * CHUNK_SIZE, activeChunkCoords.y * CHUNK_SIZE, activeChunkCoords.z * CHUNK_SIZE)
        );

        // For now, editing is only on the displayed 'window.theVoxelChunk' or the ground plane.
        // We assume window.theVoxelChunk IS the mesh for activeChunkCoords.
        if (clickedMesh !== window.theVoxelChunk && clickedMesh !== groundPlane) {
            return; 
        }

        if (isRightClick) { 
            if (clickedMesh === window.theVoxelChunk) {
                let pointInside = pickInfo.pickedPoint.subtract(pickInfo.getNormal(true, false).scale(0.1));
                const localVoxelCoords = worldToVoxelLocalCoords(pointInside.x, pointInside.y, pointInside.z, activeChunkWorldOrigin);
                
                if (getBlockType(activeChunkCoords.x, activeChunkCoords.y, activeChunkCoords.z, localVoxelCoords.x, localVoxelCoords.y, localVoxelCoords.z) !== 0) {
                    saveUndoState();
                    setBlock(activeChunkCoords.x, activeChunkCoords.y, activeChunkCoords.z, localVoxelCoords.x, localVoxelCoords.y, localVoxelCoords.z, 0); 
                    regenerateActiveChunkMesh();
                }
            }
        } else { // Add Block
            let normal = pickInfo.getNormal(true, false);
            if (!normal) return;

            let pointForNewBlock = pickInfo.pickedPoint.add(normal.scale(0.1));
            // If clicking ground, new block is in activeChunkCoords. If clicking existing chunk, also in activeChunkCoords.
            const localPositionToAdd = worldToVoxelLocalCoords(pointForNewBlock.x, pointForNewBlock.y, pointForNewBlock.z, activeChunkWorldOrigin);
            
            if (localPositionToAdd.x >= 0 && localPositionToAdd.x < CHUNK_SIZE &&
                localPositionToAdd.y >= 0 && localPositionToAdd.y < CHUNK_SIZE &&
                localPositionToAdd.z >= 0 && localPositionToAdd.z < CHUNK_SIZE) {
                
                const blockTypeToPlace = window.currentSelectedBlockType || 1; 
                if (getBlockType(activeChunkCoords.x, activeChunkCoords.y, activeChunkCoords.z, localPositionToAdd.x, localPositionToAdd.y, localPositionToAdd.z) === 0) {
                    saveUndoState();
                    setBlock(activeChunkCoords.x, activeChunkCoords.y, activeChunkCoords.z, localPositionToAdd.x, localPositionToAdd.y, localPositionToAdd.z, blockTypeToPlace);
                    regenerateActiveChunkMesh();
                }
            }
        }
    };
}

function regenerateActiveChunkMesh() { 
    const currentMaterial = window.theVoxelChunk ? window.theVoxelChunk.material : null;
    const currentMaterialName = (currentMaterial && currentMaterial.name === "voxelTextureMaterial") ? "voxelTextureMaterial" : null;

    if (window.theVoxelChunk) {
        window.theVoxelChunk.dispose();
    }
    
    window.theVoxelChunk = createMergedChunkMesh(sceneRef, activeChunkCoords.x, activeChunkCoords.y, activeChunkCoords.z); 
    
    if (window.theVoxelChunk) {
        const baseChunkWorldPos = window.theVoxelChunkOriginalPosition || new BABYLON.Vector3(0,0,0);
        let newPosition = baseChunkWorldPos.add(
            new BABYLON.Vector3(activeChunkCoords.x * CHUNK_SIZE, activeChunkCoords.y * CHUNK_SIZE, activeChunkCoords.z * CHUNK_SIZE)
        );
        window.theVoxelChunk.position = newPosition;

        if (currentMaterialName === "voxelTextureMaterial" && window.currentAppliedVoxelMaterial) {
             window.theVoxelChunk.material = window.currentAppliedVoxelMaterial;
        }
    }
}
