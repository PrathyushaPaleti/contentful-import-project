require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const contentful = require('contentful-management');

const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function uploadAsset(folderPath) {
    try {
      const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
      const environment = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT_ID || 'master');

      const files = await fs.readdir(folderPath);

      for (const file of files) {
        const filePath = path.join(folderPath, file);

        // Ensure the item is a file and not a subdirectory
        if (fs.statSync(filePath).isFile()) {
          console.log(`Uploading file: ${file}`);

      // Step 1: Create the asset
      const fileName = path.basename(filePath);
      const asset = await environment.createAssetFromFiles({
        fields: {
          title: { 'en-US': fileName },
          file: {
            'en-US': {
              contentType: 'image/jpg', // Adjust based on file type
              fileName: fileName,
              file: fs.readFileSync(filePath),
            },
          },
        },
      });

      console.log(`Asset created: ${asset.sys.id}`);

      // Step 2: Process the asset
      await asset.processForAllLocales();
      console.log('Asset processing started...');

      // Step 3: Fetch the latest version of the asset
      const updatedAsset = await environment.getAsset(asset.sys.id);
      console.log(`Latest version of asset: ${updatedAsset.sys.version}`);

      // Step 4: Publish the asset
      const publishedAsset = await updatedAsset.publish();
      console.log(`Asset published: ${publishedAsset.sys.id}`);
    }
    }
  } catch (error) {
    console.error('Error uploading assets:', error);
  }
}

// Provide the path to the image file
uploadAsset('assets/images');