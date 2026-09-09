import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

async function trimImage(imagePath) {
  try {
    const absolutePath = path.resolve(imagePath);
    console.log(`Processing: ${absolutePath}`);
    
    // Read the original image into a buffer
    const imageBuffer = await fs.readFile(absolutePath);
    
    // Trim the image (this automatically removes transparent boundaries)
    const trimmedBuffer = await sharp(imageBuffer)
      .trim()
      .toBuffer();
      
    // Overwrite the original file with the trimmed version
    await fs.writeFile(absolutePath, trimmedBuffer);
    
    console.log(`Successfully trimmed and replaced: ${imagePath}`);
  } catch (error) {
    console.error(`Error processing image ${imagePath}:`, error.message);
    process.exit(1);
  }
}

// Get the image path from the command line arguments
const targetImage = process.argv[2];

if (!targetImage) {
  console.error('Please provide an image path as an argument.');
  console.error('Usage: node trim_image.mjs <path/to/image.png>');
  process.exit(1);
}

trimImage(targetImage);
