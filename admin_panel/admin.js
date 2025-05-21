// admin_panel/admin.js
import { exportVoxelMeshToGLB } from '../voxel_engine/voxel-renderer.js';
import { generateImageFromPrompt } from '../ai_components/llm-service.js';
import { undoLastEdit } from '../voxel_engine/voxel-editor.js'; 
import { generateSimpleChunkData } from '../procedural_generator/basic-generator.js';
import * as WorldData from '../world_data.js';

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
        console.warn("API Key input or status element not found initially for admin.js.");
        if(apiKeyStatus) apiKeyStatus.textContent = "API Key UI failed to load.";
    }

    if (saveLlmApiKeyButton && llmApiKeyInput && apiKeyStatus) {
        saveLlmApiKeyButton.addEventListener('click', () => {
            const apiKeyVal = llmApiKeyInput.value.trim();
            if (apiKeyVal) {
                try {
                    sessionStorage.setItem(LLM_API_KEY_SESSION_STORAGE_KEY, apiKeyVal);
                    apiKeyStatus.textContent = 'API Key saved for this session.';
                    console.log("LLM API Key saved to sessionStorage.");
                } catch (e) {
                    apiKeyStatus.textContent = 'Error saving API Key (storage may be full or disabled).';
                    console.error("Error saving API Key to sessionStorage:", e);
                }
            } else {
                try {
                    sessionStorage.removeItem(LLM_API_KEY_SESSION_STORAGE_KEY);
                    apiKeyStatus.textContent = 'API Key cleared from this session.';
                    console.log("LLM API Key cleared from sessionStorage.");
                } catch (e) {
                    apiKeyStatus.textContent = 'Error clearing API Key.';
                    console.error("Error clearing API Key from sessionStorage:", e);
                }
            }
        });
    } else {
        console.warn("LLM API Key UI elements (button, input, or status) not fully found for event listener setup in admin.js.");
    }

    // Texture Generation Elements
    const texturePromptInput = document.getElementById('texturePrompt');
    const generateTextureButton = document.getElementById('generateTextureBtn');
    const texturePreviewImage = document.getElementById('texturePreview');
    const textureAdminStatus = document.getElementById('textureAdminStatus');

    if (generateTextureButton && texturePromptInput && texturePreviewImage && textureAdminStatus) {
        generateTextureButton.addEventListener('click', async () => {
            const prompt = texturePromptInput.value;

            if (!prompt.trim()) {
                textureAdminStatus.textContent = 'Please enter a prompt for texture generation.';
                texturePreviewImage.src = "https://via.placeholder.com/128/FFA500/000000?Text=Enter+Prompt";
                return;
            }
            
            const apiKeyIsSet = sessionStorage.getItem(LLM_API_KEY_SESSION_STORAGE_KEY);
            if (!apiKeyIsSet) {
                textureAdminStatus.textContent = 'API Key not set. Please configure it in LLM Configuration section.';
                texturePreviewImage.src = "https://via.placeholder.com/128/FF0000/FFFFFF?Text=No+API+Key";
                return;
            }

            textureAdminStatus.textContent = 'Generating texture via API...';
            texturePreviewImage.src = "https://via.placeholder.com/128/333333/FFFFFF?Text=Loading+API..."; 

            try {
                const imageUrl = await generateImageFromPrompt(prompt); 
                texturePreviewImage.src = imageUrl; 
                textureAdminStatus.textContent = 'Preview generated. Applying to model...';

                if (window.theVoxelChunk && window.scene) {
                    if (window.theVoxelChunk.material && window.theVoxelChunk.material.name === "voxelTextureMaterial") {
                        if (window.theVoxelChunk.material.diffuseTexture) {
                            window.theVoxelChunk.material.diffuseTexture.dispose();
                        }
                        window.theVoxelChunk.material.dispose();
                    }
                    window.currentAppliedVoxelMaterial = null; 

                    const voxelMaterial = new BABYLON.StandardMaterial("voxelTextureMaterial", window.scene);
                    
                    const texture = new BABYLON.Texture(imageUrl, window.scene, 
                        false, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
                        () => { 
                            voxelMaterial.diffuseTexture = texture;
                            window.theVoxelChunk.material = voxelMaterial;
                            window.currentAppliedVoxelMaterial = voxelMaterial; 
                            textureAdminStatus.textContent = 'Texture applied! (Note: OpenAI URLs are temporary)';
                            console.log("Texture successfully loaded and applied from OpenAI URL.");
                            console.warn("Note: OpenAI image URLs are temporary and may expire after about an hour. For persistent storage, download the image and host it, or convert to DataURL if appropriate.");
                        },
                        (message, exception) => { 
                            console.error("Failed to load texture from OpenAI URL:", imageUrl, "Error message:", message, exception);
                            textureAdminStatus.textContent = 'Error: Failed to load texture image from URL. The URL might be invalid, expired, or blocked by browser security (CORS).';
                        }
                    );
                } else {
                    textureAdminStatus.textContent = 'Voxel model (window.theVoxelChunk) or scene (window.scene) not found to apply texture.';
                    console.error('window.theVoxelChunk or window.scene is not available for texture application.');
                }

            } catch (error) {
                console.error('Texture generation API call failed overall:', error);
                textureAdminStatus.textContent = `Error: ${error.message || 'Failed to generate texture via API.'}`;
                texturePreviewImage.src = "https://via.placeholder.com/128/FF0000/FFFFFF?Text=API+Error";
            }
        });
    } else {
        console.warn('One or more texture generation UI elements are missing in admin.js for setup.');
    }
    
    // GLB Export Elements
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
                    console.error('Export trigger failed:', error);
                }
            } else {
                glbExportAdminStatus.textContent = 'Export function (window.triggerVoxelExport) not ready.';
                console.error('window.triggerVoxelExport is not defined.');
            }
        });
    } else {
        if (!exportButton) console.warn('Export button (exportGlbBtn) not found in admin panel.');
        if (!glbExportAdminStatus) console.warn('Admin status element (adminStatus) for GLB export not found.');
    }

    // Block Type Selection UI
    window.currentSelectedBlockType = 1; 
    const blockTypeButtons = document.querySelectorAll('.blockTypeBtn');
    const selectedBlockStatus = document.getElementById('selectedBlockStatus');

    function updateSelectedButtonVisual(selectedBtn) {
        blockTypeButtons.forEach(btn => {
            btn.classList.remove('selected');
        });
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }
    }
    
    if (blockTypeButtons.length > 0 && selectedBlockStatus) {
        let initialButton = document.querySelector('.blockTypeBtn[data-block-type="' + window.currentSelectedBlockType + '"]');
        if (!initialButton && blockTypeButtons.length > 0) { 
             initialButton = blockTypeButtons[0]; 
             window.currentSelectedBlockType = parseInt(initialButton.dataset.blockType);
        }

        if (initialButton) {
             updateSelectedButtonVisual(initialButton);
             const initialColorName = initialButton.textContent.split('(')[1]?.replace(')','').trim() || 'Unknown';
             selectedBlockStatus.textContent = `Selected: Type ${window.currentSelectedBlockType} (${initialColorName})`;
        } else {
            selectedBlockStatus.textContent = 'No block types available or configured.';
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
    } else {
        console.warn("Block type selection UI elements not found or incomplete in admin.js.");
        if(selectedBlockStatus) selectedBlockStatus.textContent = "Block selection UI failed to load.";
    }

    // Undo Button
    const undoButton = document.getElementById('undoEditBtn');
    if (undoButton) {
        undoButton.addEventListener('click', () => {
            undoLastEdit(); 
        });
    } else {
        console.warn("Undo button (undoEditBtn) not found in admin.js.");
    }

    // Procedural Generation Button
    const generateTestChunkButton = document.getElementById('generateTestChunkBtn');
    const procGenStatus = document.getElementById('procGenStatus');

    if (generateTestChunkButton && procGenStatus) {
        generateTestChunkButton.addEventListener('click', () => {
            const testChunkX = 0;
            const testChunkY = 0; 
            const testChunkZ = 1; 

            procGenStatus.textContent = `Generating chunk data for (${testChunkX},${testChunkY},${testChunkZ})...`;
            try {
                const newChunkDataArray = generateSimpleChunkData(testChunkX, testChunkY, testChunkZ);
                WorldData.setChunkData(testChunkX, testChunkY, testChunkZ, newChunkDataArray);
                procGenStatus.textContent = `Chunk (${testChunkX},${testChunkY},${testChunkZ}) data stored. `;
                
                if (window.updateWorldView) {
                    window.updateWorldView(); 
                    procGenStatus.textContent += "World view updated.";
                    console.log(`Chunk (${testChunkX},${testChunkY},${testChunkZ}) generated and view updated.`);
                } else {
                    procGenStatus.textContent += "View update function not found.";
                    console.error("window.updateWorldView is not defined after generating chunk.");
                }
            } catch (error) {
                procGenStatus.textContent = `Error generating chunk: ${error.message}`;
                console.error("Error generating test chunk:", error);
            }
        });
    } else {
        console.warn("Procedural generation UI elements (button or status) not found in admin.js.");
        if(procGenStatus) procGenStatus.textContent = "ProcGen UI failed to load.";
    }
});
