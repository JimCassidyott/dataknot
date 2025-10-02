const { CozoDb } = require('cozo-node');
const path = require('path'); // Node.js built-in path module

// Define the directory where you want to store your CozoDB data
// Make sure this directory exists or Cozo-node might throw an error.
// For example, you can create it with `mkdir -p /path/to/your/cozodb_data`
const dataDirectory = 'cozodb_rocksdb_data'; // Or any other suitable path on your drive

async function runCozoTest() {
  let db;
  try {
    // Initialize CozoDb with RocksDB engine and a specified path
    // The 'R' for engine signifies RocksDB.
    // The path should point to a directory where RocksDB will store its files.
    db = new CozoDb('R', dataDirectory); 
    console.log(`CozoDB initialized with RocksDB at: ${dataDirectory}`);

    // --- Test 1: Insert some data ---
    console.log('\n--- Inserting data ---');
    const insertQuery = `
      ?[a, b] <- [[1, "hello"], [2, "world"], [3, "cozo"]]
    `;
    const insertResult = await db.run(insertQuery);
    console.log('Insert result:', insertResult);

    // --- Test 2: Query the data ---
    console.log('\n--- Querying data ---');
    const selectQuery = `
      ?[a, b] := a in [1, 2, 3], b = "hello" or b = "world" or b = "cozo"
    `;
    const selectResult = await db.run(selectQuery);
    console.log('Select result:', selectResult);

    // --- Test 3: Update some data ---
    console.log('\n--- Updating data (e.g., delete and re-insert) ---');
    // CozoDB is declarative, updates are often done by deleting and re-inserting
    const deleteQuery = `
      :delete a, b <- [[2, "world"]]
    `;
    await db.run(deleteQuery);
    console.log('Deleted [2, "world"]');

    const insertNewQuery = `
      ?[a, b] <- [[2, "updated_world"]]
    `;
    await db.run(insertNewQuery);
    console.log('Inserted [2, "updated_world"]');

    console.log('\n--- Querying data after update ---');
    const selectAfterUpdateResult = await db.run(`?[a, b]`);
    console.log('Select result after update:', selectAfterUpdateResult);

    // --- Test 4: Verify persistence (optional, requires restarting the script) ---
    // To truly test persistence, you would stop this script, then run another script
    // that initializes CozoDb with the *same* 'R' engine and `dataDirectory` path
    // and queries the data. The data should still be there.
    console.log(`\nTo test persistence, stop this script, then run a new script that connects to the same path (${dataDirectory}) and queries the data. It should still be present.`);

  } catch (error) {
    console.error('An error occurred:', error.display || error.message);
  } finally {
    // Always close the database connection when you're done
    if (db) {
      await db.close();
      console.log('CozoDB connection closed.');
    }
  }
}

// Ensure the data directory exists before running the test
const fs = require('fs');
if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
    console.log(`Created data directory: ${dataDirectory}`);
}

runCozoTest();