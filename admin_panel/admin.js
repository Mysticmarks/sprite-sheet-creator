// admin_panel/admin.js
import { exportVoxelMeshToGLB } from '../voxel_engine/voxel-renderer.js';
import { generateImageFromPrompt } from '../ai_components/llm-service.js';
import { undoLastEdit } from '../voxel_engine/voxel-editor.js'; 
import { generateSimpleChunkData } from '../procedural_generator/basic-generator.js';
import * as WorldData from '../world_data.js';
import { CHUNK_SIZE } from '../voxel_engine/voxel-data-declarations.js'; 

// Ensure global initializations for texture caches are at the top
if (typeof window.blockTypeTextureURLs === 'undefined') window.blockTypeTextureURLs = {};
if (typeof window.blockTypeMaterialsCache === 'undefined') window.blockTypeMaterialsCache = {};

const VOXEL_WORLD_LOCAL_STORAGE_KEY = 'myVoxelWorldData'; // Consistent key

document.addEventListener('DOMContentLoaded', () => {
    // LLM API Key Configuration Elements
    const llmApiKeyInput = document.getElementById('llmApiKey');
    const saveLlmApiKeyButton = document.getElementById('saveLlmApiKeyBtn');
    const apiKeyStatus = document.getElementById('apiKeyStatus');
    const LLM_API_KEY_SESSION_STORAGE_KEY = 'llmApiKey';

    if (llmApiKeyInput && apiKeyStatus) {
        const storedApiKey = sessionStorage.getItem(LLM_API_KEY_SESSION_STORAGE_KEY);
        if (storedApiKey) {
            llmApiKeyInput.value = storedApiKey;
            apiKeyStatus.textContent = 'API Key loaded from session.';
        } else {
            apiKeyStatus.textContent = 'API Key not set for this session.';
        }
    } else {
        if(apiKeyStatus) apiKeyStatus.textContent = "API Key UI failed to load.";
    }

    if (saveLlmApiKeyButton && llmApiKeyInput && apiKeyStatus) {
        saveLlmApiKeyButton.addEventListener('click', () => {
            const apiKeyVal = llmApiKeyInput.value.trim();
            if (apiKeyVal) {
                try {
                    sessionStorage.setItem(LLM_API_KEY_SESSION_STORAGE_KEY, apiKeyVal);
                    apiKeyStatus.textContent = 'API Key saved for this session.';
                } catch (e) {
                    apiKeyStatus.textContent = 'Error saving API Key (storage may be full or disabled).';
                }
            } else {
                try {
                    sessionStorage.removeItem(LLM_API_KEY_SESSION_STORAGE_KEY);
                    apiKeyStatus.textContent = 'API Key cleared from this session.';
                } catch (e) {
                    apiKeyStatus.textContent = 'Error clearing API Key.';
                }
            }
        });
    }

    // Texture Generation Elements
    const texturePromptInput = document.getElementById('texturePrompt');
    const generateTextureButton = document.getElementById('generateTextureBtn');
    const texturePreviewImage = document.getElementById('texturePreview');
    const textureAdminStatus = document.getElementById('textureAdminStatus');

    if (generateTextureButton && texturePromptInput && texturePreviewImage && textureAdminStatus) {
        generateTextureButton.addEventListener('click', async () => {
            const prompt = texturePromptInput.value;
            const selectedType = window.currentSelectedBlockType; 
            if (!selectedType && selectedType !== 0) { 
                textureAdminStatus.textContent = 'Please select a block type first.';
                return;
            }
            const apiKeyIsSet = sessionStorage.getItem(LLM_API_KEY_SESSION_STORAGE_KEY);
            if (!apiKeyIsSet) {
                textureAdminStatus.textContent = 'API Key not set. Please configure it in LLM Configuration.';
                return;
            }
            if (!prompt.trim()) {
                textureAdminStatus.textContent = 'Please enter a prompt for texture generation.';
                return;
            }
            textureAdminStatus.textContent = `Generating texture for Block Type ${selectedType} via API...`;
            texturePreviewImage.src = "https://via.placeholder.com/128/333333/FFFFFF?Text=Loading+API..."; 
            try {
                const imageUrl = await generateImageFromPrompt(prompt); 
                texturePreviewImage.src = imageUrl; 
                const oldMaterialCacheKey = Object.keys(window.blockTypeMaterialsCache).find(key => key.startsWith(`type_${selectedType}_tex_`));
                if (oldMaterialCacheKey && window.blockTypeMaterialsCache[oldMaterialCacheKey]) {
                    window.blockTypeMaterialsCache[oldMaterialCacheKey].dispose(); 
                    delete window.blockTypeMaterialsCache[oldMaterialCacheKey];
                }
                window.blockTypeTextureURLs[selectedType] = imageUrl;
                textureAdminStatus.textContent = `Texture URL for Block Type ${selectedType} set. Updating world...`;
                if (window.updateWorldView) {
                    window.updateWorldView(); 
                    textureAdminStatus.textContent += ` World updated. (OpenAI URLs are temporary)`;
                } else {
                    textureAdminStatus.textContent += " View update function not found.";
                }
            } catch (error) {
                textureAdminStatus.textContent = `Error (Type ${selectedType}): ${error.message || 'Failed to generate texture.'}`;
                texturePreviewImage.src = "https://via.placeholder.com/128/FF0000/FFFFFF?Text=API+Error";
            }
        });
    }
    
    // GLB Export Elements & Status
    const exportButton = document.getElementById('exportGlbBtn');
    const glbExportAdminStatus = document.getElementById('adminStatus');

    if (exportButton && glbExportAdminStatus) {
        exportButton.addEventListener('click', async () => {
            if (window.triggerVoxelExport) {
                glbExportAdminStatus.textContent = 'Exporting GLB...';
                try {
                    await window.triggerVoxelExport();
                } catch (error) {
                    glbExportAdminStatus.textContent = 'Error during GLB export: ' + error.message;
                }
            } else {
                glbExportAdminStatus.textContent = 'Export function (window.triggerVoxelExport) not ready.';
            }
        });
    }

    // Block Type Selection UI
    window.currentSelectedBlockType = 1; 
    const blockTypeButtons = document.querySelectorAll('.blockTypeBtn');
    const selectedBlockStatus = document.getElementById('selectedBlockStatus');

    function updateSelectedButtonVisual(selectedBtn) {
        blockTypeButtons.forEach(btn => btn.classList.remove('selected'));
        if (selectedBtn) selectedBtn.classList.add('selected');
    }
    
    if (blockTypeButtons.length > 0 && selectedBlockStatus) {
        let initialButton = document.querySelector('.blockTypeBtn[data-block-type="' + window.currentSelectedBlockType + '"]') || blockTypeButtons[0];
        if (initialButton) {
            window.currentSelectedBlockType = parseInt(initialButton.dataset.blockType);
            updateSelectedButtonVisual(initialButton);
            const initialColorName = initialButton.textContent.split('(')[1]?.replace(')','').trim() || 'Unknown';
            selectedBlockStatus.textContent = `Selected: Type ${window.currentSelectedBlockType} (${initialColorName})`;
        } else {
             selectedBlockStatus.textContent = 'No block types available.';
        }
        blockTypeButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const clickedButton = event.currentTarget;
                updateSelectedButtonVisual(clickedButton); 
                window.currentSelectedBlockType = parseInt(clickedButton.dataset.blockType);
                const colorName = clickedButton.textContent.split('(')[1]?.replace(')','').trim() || 'Unknown';
                selectedBlockStatus.textContent = `Selected: Type ${window.currentSelectedBlockType} (${colorName})`;
            });
        });
    }

    // Undo Button
    const undoButton = document.getElementById('undoEditBtn');
    if (undoButton) {
        undoButton.addEventListener('click', () => undoLastEdit());
    }

    // Procedural Generation Button & Config Inputs
    const generateTestChunkButton = document.getElementById('generateTestChunkBtn');
    const procGenStatus = document.getElementById('procGenStatus');
    const noiseScaleInput = document.getElementById('noiseScale');
    const noiseAmplitudeInput = document.getElementById('noiseAmplitude');
    const baseHeightInput = document.getElementById('baseHeight');

    if (generateTestChunkButton && procGenStatus && noiseScaleInput && noiseAmplitudeInput && baseHeightInput) {
        generateTestChunkButton.addEventListener('click', () => {
            const testChunkX = 0, testChunkY = 0, testChunkZ = 1; 
            let noiseConfig = {
                noiseScale: parseFloat(noiseScaleInput.value),
                noiseAmplitude: parseFloat(noiseAmplitudeInput.value),
                baseHeight: parseInt(baseHeightInput.value)
            };
            noiseConfig.noiseScale = Math.max(1, Math.min(128, isNaN(noiseConfig.noiseScale) ? 32 : noiseConfig.noiseScale));
            noiseScaleInput.value = noiseConfig.noiseScale;
            noiseConfig.baseHeight = Math.max(0, Math.min(10, isNaN(noiseConfig.baseHeight) ? 1 : noiseConfig.baseHeight));
            baseHeightInput.value = noiseConfig.baseHeight;
            let maxPossibleAmplitude = CHUNK_SIZE - 1 - noiseConfig.baseHeight;
            noiseConfig.noiseAmplitude = Math.max(0, Math.min(maxPossibleAmplitude, isNaN(noiseConfig.noiseAmplitude) ? 4 : noiseConfig.noiseAmplitude));
            noiseConfig.noiseAmplitude = Math.min(15, noiseConfig.noiseAmplitude); 
            noiseAmplitudeInput.value = noiseConfig.noiseAmplitude;
            procGenStatus.textContent = `Generating chunk (${testChunkX},${testChunkY},${testChunkZ}) with config...`;
            try {
                const newChunkDataArray = generateSimpleChunkData(testChunkX, testChunkY, testChunkZ, noiseConfig);
                WorldData.setChunkData(testChunkX, testChunkY, testChunkZ, newChunkDataArray);
                procGenStatus.textContent = `Chunk (${testChunkX},${testChunkY},${testChunkZ}) data stored. `;
                if (window.updateWorldView) {
                    window.updateWorldView(); 
                    procGenStatus.textContent += "World view updated.";
                } else {
                    procGenStatus.textContent += "View update function not found.";
                }
            } catch (error) {
                procGenStatus.textContent = `Error generating chunk: ${error.message}`;
            }
        });
    }

    // World Save/Load
    const saveWorldButton = document.getElementById('saveWorldBtn');
    const loadWorldButton = document.getElementById('loadWorldBtn');
    const saveLoadStatus = document.getElementById('saveLoadStatus');

    if (saveWorldButton && loadWorldButton && saveLoadStatus) {
        saveWorldButton.addEventListener('click', () => {
            saveLoadStatus.textContent = "Saving world...";
            try {
                const worldChunksToSave = {};
                const allCoords = WorldData.getAllChunkCoordinates();
                allCoords.forEach(coords => {
                    const chunkKey = `${coords.x},${coords.y},${coords.z}`;
                    worldChunksToSave[chunkKey] = WorldData.getChunkData(coords.x, coords.y, coords.z);
                });
                const dataToStore = {
                    worldChunks: worldChunksToSave,
                    textureAssignments: window.blockTypeTextureURLs || {}
                };
                localStorage.setItem(VOXEL_WORLD_LOCAL_STORAGE_KEY, JSON.stringify(dataToStore));
                saveLoadStatus.textContent = "World saved to LocalStorage!";
                console.log("World saved to LocalStorage:", dataToStore);
            } catch (error) {
                saveLoadStatus.textContent = `Error saving world: ${error.message}`;
                console.error("Error saving world to LocalStorage:", error);
            }
        });

        loadWorldButton.addEventListener('click', () => {
            saveLoadStatus.textContent = "Loading world...";
            const savedDataString = localStorage.getItem(VOXEL_WORLD_LOCAL_STORAGE_KEY);
            if (!savedDataString) {
                saveLoadStatus.textContent = "No saved world data found in LocalStorage.";
                return;
            }
            try {
                const loadedData = JSON.parse(savedDataString);
                if (!loadedData || typeof loadedData.worldChunks === 'undefined') {
                    throw new Error("Invalid or incomplete saved data format.");
                }
                WorldData.clearAllChunks(); 
                if (window.blockTypeMaterialsCache) { 
                    Object.values(window.blockTypeMaterialsCache).forEach(mat => {
                        if(mat && typeof mat.dispose === 'function') mat.dispose();
                    });
                }
                window.blockTypeTextureURLs = loadedData.textureAssignments || {};
                window.blockTypeMaterialsCache = {}; 
                for (const key in loadedData.worldChunks) {
                    if (Object.hasOwnProperty.call(loadedData.worldChunks, key)) {
                        const coords = key.split(',').map(Number);
                        if (loadedData.worldChunks[key]) { 
                           WorldData.setChunkData(coords[0], coords[1], coords[2], loadedData.worldChunks[key]);
                        } else {
                           console.warn(`Null or undefined chunk data found in localStorage for key ${key}`);
                        }
                    }
                }
                if (window.updateWorldView) {
                    window.updateWorldView(); 
                    saveLoadStatus.textContent = "World loaded from LocalStorage and view updated!";
                } else {
                    saveLoadStatus.textContent = "World data loaded, but view updater (window.updateWorldView) not found.";
                }
                console.log("World loaded from LocalStorage:", loadedData);
            } catch (error) {
                saveLoadStatus.textContent = `Error loading world: ${error.message}`;
                console.error("Error loading world from LocalStorage:", error);
                if(window.resetInitialChunk) window.resetInitialChunk(); // Attempt to reset to default
                else if(window.updateWorldView) window.updateWorldView(); // Fallback to just updating view if reset not there
            }
        });
    } else {
        if(saveLoadStatus) saveLoadStatus.textContent = "Save/Load UI failed to load.";
    }
});
