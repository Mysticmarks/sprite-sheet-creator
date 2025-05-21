// voxel_engine/voxel-data.test.js
import { CHUNK_SIZE } from './voxel-data-declarations.js'; // Correct import
import { setBlock, getBlock, getBlockType, getBlockColor, resetChunkData } from './voxel-data.js';

function assert(condition, message) {
    if (!condition) {
        console.error(`Assertion Failed: ${message}`);
    } else {
        console.log(`Assertion Passed: ${message}.`);
    }
}

function assertDeepEquals(expected, actual, message) {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        console.error(`Assertion Failed: ${message}. Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
    } else {
        console.log(`Assertion Passed: ${message}.`);
    }
}

function runVoxelDataTests() {
    console.log("--- Running Voxel Data Tests (Multi-Chunk Refactor) ---");
    const C_X = 0, C_Y = 0, C_Z = 0; // Default chunk for these tests

    resetChunkData(C_X, C_Y, C_Z); // Ensure clean state for chunk (0,0,0)

    // Test 1: Initial block at (0,0,0) in chunk (0,0,0) - Type 1, should have default red color
    let block000 = getBlock(C_X, C_Y, C_Z, 0,0,0);
    assert(block000 && block000.type === 1, `Block (0,0,0) in chunk (${C_X},${C_Y},${C_Z}) type should be 1`);
    assertDeepEquals([0.8, 0.2, 0.2], block000.color, `Block (0,0,0) in chunk (${C_X},${C_Y},${C_Z}) color should be default red`);

    // Test 2: Set and get a block with a specific color in chunk (0,0,0)
    setBlock(C_X, C_Y, C_Z, 1, 1, 1, 2, [0.1, 0.2, 0.3]);
    let block111 = getBlock(C_X, C_Y, C_Z, 1,1,1);
    assert(block111 && block111.type === 2, `Block (1,1,1) in chunk (${C_X},${C_Y},${C_Z}) type should be 2`);
    assertDeepEquals([0.1, 0.2, 0.3], block111.color, `Block (1,1,1) in chunk (${C_X},${C_Y},${C_Z}) color should be custom [0.1,0.2,0.3]`);

    // Test 3: Set a block type that has a default color, without specifying color
    setBlock(C_X, C_Y, C_Z, 2,2,2, 3); // Type 3 has default blue
    let block222 = getBlock(C_X, C_Y, C_Z, 2,2,2);
    assert(block222 && block222.type === 3, `Block (2,2,2) in chunk (${C_X},${C_Y},${C_Z}) type should be 3`);
    assertDeepEquals([0.2, 0.2, 0.8], block222.color, `Block (2,2,2) in chunk (${C_X},${C_Y},${C_Z}) color should be default blue`);

    // Test 4: Set a block type with no default color, without specifying color
    setBlock(C_X, C_Y, C_Z, 3,3,3, 5); // Assuming Type 5 has no default color
    let block333 = getBlock(C_X, C_Y, C_Z, 3,3,3);
    assert(block333 && block333.type === 5, `Block (3,3,3) in chunk (${C_X},${C_Y},${C_Z}) type should be 5`);
    assert(block333.color === undefined, `Block (3,3,3) in chunk (${C_X},${C_Y},${C_Z}) color should be undefined`);

    // Test 5: Get an air block
    assert(getBlock(C_X, C_Y, C_Z, 4,4,4) === 0, `Block (4,4,4) in chunk (${C_X},${C_Y},${C_Z}) should be air (0)`);
    assert(getBlockType(C_X, C_Y, C_Z, 4,4,4) === 0, `getBlockType for air block (4,4,4) in chunk (${C_X},${C_Y},${C_Z}) should be 0`);
    assert(getBlockColor(C_X, C_Y, C_Z, 4,4,4) === null, `getBlockColor for air block (4,4,4) in chunk (${C_X},${C_Y},${C_Z}) should be null`);
    
    // Test 6: Out of bounds local coordinates checks (should return 0 or null)
    assert(getBlock(C_X, C_Y, C_Z, -1,0,0) === 0, "getBlock with local out of bounds should be 0");
    assert(getBlockType(C_X, C_Y, C_Z, -1,0,0) === 0, "getBlockType with local out of bounds should be 0");
    assert(getBlockColor(C_X, C_Y, C_Z, -1,0,0) === null, "getBlockColor with local out of bounds should be null");
    assert(getBlock(C_X, C_Y, C_Z, CHUNK_SIZE,0,0) === 0, "getBlock with local out of bounds (CHUNK_SIZE) should be 0");


    // Test 7: Overwrite block with specific color, then with default color
    setBlock(C_X, C_Y, C_Z, 0,0,0, 1, [0.5,0.5,0.5]); // Custom grey
    assertDeepEquals([0.5,0.5,0.5], getBlockColor(C_X, C_Y, C_Z, 0,0,0), `Block (0,0,0) in chunk (${C_X},${C_Y},${C_Z}) overwritten with custom grey`);
    setBlock(C_X, C_Y, C_Z, 0,0,0, 1); // Set again, should revert to default red for type 1
    assertDeepEquals([0.8,0.2,0.2], getBlockColor(C_X, C_Y, C_Z, 0,0,0), `Block (0,0,0) in chunk (${C_X},${C_Y},${C_Z}) reset to default red`);
    
    // Test 8: Set a block to air
    setBlock(C_X, C_Y, C_Z, 1,1,1, 0); // Was type 2, custom color
    assert(getBlock(C_X, C_Y, C_Z, 1,1,1) === 0, `Set block (1,1,1) in chunk (${C_X},${C_Y},${C_Z}) to air`);

    // Test 9: Check initial custom yellow block from resetChunkData for chunk (0,0,0)
    let block110 = getBlock(C_X, C_Y, C_Z, 1,1,0);
    assert(block110 && block110.type === 1, `Initial block (1,1,0) in chunk (${C_X},${C_Y},${C_Z}) type should be 1`);
    assertDeepEquals([0.9,0.9,0.1], block110.color, `Initial block (1,1,0) in chunk (${C_X},${C_Y},${C_Z}) color should be custom yellow`);

    // Test 10: Check initial gold block from resetChunkData for chunk (0,0,0)
    let block210 = getBlock(C_X, C_Y, C_Z, 2,1,0);
    assert(block210 && block210.type === 4, `Initial block (2,1,0) in chunk (${C_X},${C_Y},${C_Z}) type should be 4`);
    assertDeepEquals([0.9,0.7,0.1], block210.color, `Initial block (2,1,0) in chunk (${C_X},${C_Y},${C_Z}) color should be default gold`);

    // Test 11: Accessing a non-existent chunk should return air/0
    console.log("Testing non-existent chunk (1,1,1):");
    assert(getBlock(1,1,1, 0,0,0) === 0, "getBlock for non-existent chunk (1,1,1) should be 0 (air)");
    assert(getBlockType(1,1,1, 0,0,0) === 0, "getBlockType for non-existent chunk (1,1,1) should be 0");
    assert(getBlockColor(1,1,1, 0,0,0) === null, "getBlockColor for non-existent chunk (1,1,1) should be null");


    console.log("--- Voxel Data Tests (Multi-Chunk Refactor) Complete ---");
}

if (typeof window !== 'undefined') {
    window.runVoxelDataColorTests = runVoxelDataTests; 
}
runVoxelDataTests();
