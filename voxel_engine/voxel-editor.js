// voxel_engine/voxel-editor.js
import * as BABYLON from 'babylonjs';
import { CHUNK_SIZE } from './voxel-data-declarations.js';
import { setBlock, getBlock, getBlockType, getChunkDataCopyForUndo, setChunkDataFromCopyForUndo } from './voxel-data.js';
import { createMergedChunkMesh } from './voxel-renderer.js';

let sceneRef;
let groundPlane; 
let activeChunkCoords = { x: 0, y: 0, z: 0 }; 

const MAX_UNDO_STEPS = 20;
let undoStack = [];

let highlightMesh; // For visual feedback

// Helper functions (ensure these are correctly defined as per previous steps)
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

function saveUndoState() { 
    if (undoStack.length >= MAX_UNDO_STEPS) undoStack.shift();
    const chunkDataToSave = getChunkDataCopyForUndo(activeChunkCoords.x, activeChunkCoords.y, activeChunkCoords.z);
    if (chunkDataToSave) {
        undoStack.push(chunkDataToSave);
    } else {
        // This might happen if the active chunk doesn't exist in WorldData yet, though editor assumes it does.
        console.warn("saveUndoState: Could not get chunk data for active chunk", activeChunkCoords);
    }
    const undoBtn = document.getElementById('undoEditBtn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
}

export function undoLastEdit() { 
    if (undoStack.length > 0) {
        const previousState = undoStack.pop();
        setChunkDataFromCopyForUndo(activeChunkCoords.x, activeChunkCoords.y, activeChunkCoords.z, previousState);
        regenerateActiveChunkMesh(); 
        const undoBtn = document.getElementById('undoEditBtn');
        if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    }
}

function regenerateActiveChunkMesh() { 
    if (window.updateWorldView) {
        window.updateWorldView(); 
    } else {
        console.error("regenerateActiveChunkMesh: window.updateWorldView is not available!");
    }
    const undoBtn = document.getElementById('undoEditBtn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0; // Keep undo button state updated
}


export function initVoxelEditor(babylonScene) {
    sceneRef = babylonScene;
    
    const baseChunkWorldPos = window.theVoxelChunkOriginalPosition || new BABYLON.Vector3(0,0,0);
    const groundYPosition = baseChunkWorldPos.y - 0.5; 
    const groundXPosition = baseChunkWorldPos.x + CHUNK_SIZE / 2 - 0.5;
    const groundZPosition = baseChunkWorldPos.z + CHUNK_SIZE / 2 - 0.5;

    groundPlane = BABYLON.MeshBuilder.CreateGround("voxelEditGround", { width: CHUNK_SIZE * 3, height: CHUNK_SIZE * 3 }, sceneRef);
    groundPlane.position = new BABYLON.Vector3(groundXPosition, groundYPosition, groundZPosition);
    groundPlane.visibility = 0.0; 
    groundPlane.isPickable = true;
    // groundPlane.enablePointerMoveEvents = false; // Not needed if scene.onPointerMove is used with predicate

    // Create highlight mesh
    highlightMesh = BABYLON.MeshBuilder.CreateBox("highlightBox", { size: 1.01 }, sceneRef);
    const highlightMaterial = new BABYLON.StandardMaterial("highlightMat", sceneRef);
    highlightMaterial.emissiveColor = BABYLON.Color3.Yellow();
    highlightMaterial.wireframe = true;
    highlightMaterial.alpha = 0.5; // Wireframe can still have alpha to be less obtrusive
    highlightMesh.material = highlightMaterial;
    highlightMesh.isPickable = false;
    highlightMesh.isVisible = false;

    const undoBtn = document.getElementById('undoEditBtn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;

    sceneRef.onPointerMove = (evt, pickInfo) => { // evt and pickInfo are from the event, not mandatory to use if doing fresh pick
        pickInfo = sceneRef.pick(sceneRef.pointerX, sceneRef.pointerY, (mesh) => mesh.isPickable && (mesh === window.theVoxelChunk || mesh === groundPlane));

        if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
            let normal = pickInfo.getNormal(true, false);
            if (!normal) {
                highlightMesh.isVisible = false;
                return;
            }
            
            const activeChunkWorldOrigin = (window.theVoxelChunkOriginalPosition || new BABYLON.Vector3(0,0,0)).add(
                new BABYLON.Vector3(activeChunkCoords.x * CHUNK_SIZE, activeChunkCoords.y * CHUNK_SIZE, activeChunkCoords.z * CHUNK_SIZE)
            );

            let targetLocalCoords;
            // If the hit is on the main voxel chunk, highlight the cell of the hit block (for removal)
            if (pickInfo.pickedMesh === window.theVoxelChunk) {
                let pointInsideBlock = pickInfo.pickedPoint.subtract(normal.scale(0.1)); // Move into the block
                targetLocalCoords = worldToVoxelLocalCoords(pointInsideBlock.x, pointInsideBlock.y, pointInsideBlock.z, activeChunkWorldOrigin);
            } else if (pickInfo.pickedMesh === groundPlane) { // If hit is on ground, highlight cell for placement
                let pointForNewBlock = pickInfo.pickedPoint.add(normal.scale(0.1)); // Move into the new cell
                targetLocalCoords = worldToVoxelLocalCoords(pointForNewBlock.x, pointForNewBlock.y, pointForNewBlock.z, activeChunkWorldOrigin);
            } else {
                highlightMesh.isVisible = false;
                return;
            }
            
            // Check bounds for the calculated local coordinates
            if (targetLocalCoords && 
                targetLocalCoords.x >= 0 && targetLocalCoords.x < CHUNK_SIZE &&
                targetLocalCoords.y >= 0 && targetLocalCoords.y < CHUNK_SIZE &&
                targetLocalCoords.z >= 0 && targetLocalCoords.z < CHUNK_SIZE) {
                
                highlightMesh.position.set(
                    activeChunkWorldOrigin.x + targetLocalCoords.x + 0.5,
                    activeChunkWorldOrigin.y + targetLocalCoords.y + 0.5,
                    activeChunkWorldOrigin.z + targetLocalCoords.z + 0.5
                );
                highlightMesh.isVisible = true;
            } else {
                highlightMesh.isVisible = false;
            }
        } else {
            highlightMesh.isVisible = false;
        }
    }; // End of onPointerMove

    sceneRef.onPointerDown = (evt, pickInfoOnDown) => { 
        if(highlightMesh) highlightMesh.isVisible = false; 
        
        pickInfoOnDown = sceneRef.pick(sceneRef.pointerX, sceneRef.pointerY, (mesh) => mesh.isPickable && (mesh === window.theVoxelChunk || mesh === groundPlane));

        if (!pickInfoOnDown || !pickInfoOnDown.hit || !pickInfoOnDown.pickedPoint) return;

        let clickedMesh = pickInfoOnDown.pickedMesh;
        let isRightClick = evt.button === 2;
        const activeChunkWorldOrigin = (window.theVoxelChunkOriginalPosition || new BABYLON.Vector3(0,0,0)).add(
            new BABYLON.Vector3(activeChunkCoords.x * CHUNK_SIZE, activeChunkCoords.y * CHUNK_SIZE, activeChunkCoords.z * CHUNK_SIZE)
        );

        if (isRightClick) { 
            if (clickedMesh === window.theVoxelChunk) {
                let normal = pickInfoOnDown.getNormal(true, false); 
                if (!normal) return;
                let pointInside = pickInfoOnDown.pickedPoint.subtract(normal.scale(0.1));
                const localVoxelCoords = worldToVoxelLocalCoords(pointInside.x, pointInside.y, pointInside.z, activeChunkWorldOrigin);
                
                if (getBlockType(activeChunkCoords.x, activeChunkCoords.y, activeChunkCoords.z, localVoxelCoords.x, localVoxelCoords.y, localVoxelCoords.z) !== 0) {
                    saveUndoState();
                    setBlock(activeChunkCoords.x, activeChunkCoords.y, activeChunkCoords.z, localVoxelCoords.x, localVoxelCoords.y, localVoxelCoords.z, 0); 
                    regenerateActiveChunkMesh();
                }
            }
        } else { // Add Block
            let normal = pickInfoOnDown.getNormal(true, false);
            if (!normal) return;

            let pointForNewBlock = pickInfoOnDown.pickedPoint.add(normal.scale(0.1));
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
    }; // End of onPointerDown
} // End of initVoxelEditor
