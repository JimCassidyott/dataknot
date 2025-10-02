const fs = require('fs');
const path = require('path');

// Path to the metadata file for the conversation we've been working on
const metadataPath = path.join(__dirname, 'chat_history', 'chat_1759363587825', 'metadata.json');

console.log('Reading metadata file from:', metadataPath);
console.log('=====================================');

try {
    // Check if file exists
    if (fs.existsSync(metadataPath)) {
        console.log('✅ File exists');
        
        // Read the file
        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
        console.log('\n📄 Original file content:');
        console.log(metadataContent);
        
        // Parse the metadata
        const metadata = JSON.parse(metadataContent);
        console.log('\n📋 Original metadata:');
        console.log(JSON.stringify(metadata, null, 2));
        
        // Show original projectType
        console.log('\n🎯 Original Project Type:', metadata.projectType || 'NOT SET');
        
        // Update the projectType to "recipe" and update lastModified
        const oldProjectType = metadata.projectType;
        metadata.projectType = 'recipe';
        metadata.lastModified = Date.now();
        
        console.log('\n🔄 Updating projectType from "' + oldProjectType + '" to "recipe"');
        
        // Write the updated metadata back to the file
        const updatedContent = JSON.stringify(metadata, null, 2);
        fs.writeFileSync(metadataPath, updatedContent, 'utf8');
        
        console.log('\n✅ Updated file content:');
        console.log(updatedContent);
        
        // Verify the write was successful by reading it back
        const verifyContent = fs.readFileSync(metadataPath, 'utf8');
        const verifyMetadata = JSON.parse(verifyContent);
        console.log('\n🎯 New Project Type:', verifyMetadata.projectType);
        
        console.log('\n✅ Successfully updated metadata.json with projectType: "recipe"');
        
    } else {
        console.log('❌ File does not exist');
    }
} catch (error) {
    console.error('❌ Error reading/writing metadata file:', error);
}
