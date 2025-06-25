require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const contentful = require('contentful-management');

// Load environment variables
const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENVIRONMENT_ID = process.env.CONTENTFUL_ENVIRONMENT_ID || 'master';

// Initialize Contentful Client
const client = contentful.createClient({
  accessToken: MANAGEMENT_TOKEN,
});

// Read CSV and parse authors
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Import authors into Contentful
async function importAuthors(authors) {
  try {
    const space = await client.getSpace(SPACE_ID);
    const environment = await space.getEnvironment(ENVIRONMENT_ID);

    for (const author of authors) {
      if (!author.name || !author.email) {
        console.error('Skipping row due to missing required fields:', author);
        continue; // Skip rows with missing required fields
      }

      console.log(`Processing author: ${author.name}`);

      let profilePictureId = null;

      // Step 1: Upload profile picture (if available)
      if (author.profilePicture) {
        const imagePath = path.join(__dirname, 'assets/images', author.profilePicture);

        try {
          // Create the asset
          let asset = await environment.createAssetFromFiles({
            fields: {
              title: { 'en-US': author.profilePicture },
              file: {
                'en-US': {
                  contentType: 'image/jpg',
                  fileName: author.profilePicture,
                  file: fs.readFileSync(imagePath),
                },
              },
            },
          });

          console.log(`Asset created: ${author.profilePicture}`);

          // Process the asset for all locales
          await asset.processForAllLocales();
          console.log(`Processing asset: ${author.profilePicture}`);

          // Fetch the latest asset version
          asset = await environment.getAsset(asset.sys.id);

          // Publish the asset
          const publishedAsset = await asset.publish();
          console.log(`Asset published: ${publishedAsset.sys.id}`);
          profilePictureId = publishedAsset.sys.id;
        } catch (error) {
          console.error(`Error uploading profile picture (${author.profilePicture}):`, error.message);
        }
      }

      // Step 2: Create Author Entry
      try {
        const authorEntry = await environment.createEntry('author', {
          fields: {
            name: { 'en-US': author.name },
            email: { 'en-US': author.email },
            bio: { 'en-US': author.bio || '' },
            profilePicture: profilePictureId
              ? {
                  'en-US': {
                    sys: {
                      type: 'Link',
                      linkType: 'Asset',
                      id: profilePictureId,
                    },
                  },
                }
              : null,
          },
        });

        console.log(`✔ Successfully imported author: ${author.name}`);
      } catch (entryError) {
        console.error(`Failed to create author entry for ${author.name}:`, entryError.message);
      }
    }
  } catch (error) {
    console.error('Error importing authors:', error.message);
  }
}

// Run the script
(async () => {
  const authors = await parseCSV(path.join(__dirname, 'assets/authors.csv'));
  await importAuthors(authors);
})();