const fs = require('fs');

// Function to create a simple PNG data
function createSimplePNG(size, color) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrLength = Buffer.alloc(4);
  ihdrLength.writeUInt32BE(13, 0);
  const ihdrType = Buffer.from('IHDR');
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); // width
  ihdrData.writeUInt32BE(size, 4); // height
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(6, 9); // color type (RGBA)
  ihdrData.writeUInt8(0, 10); // compression method
  ihdrData.writeUInt8(0, 11); // filter method
  ihdrData.writeUInt8(0, 12); // interlace method
  
  // Convert color to RGBA values
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const a = 255; // fully opaque
  
  // IDAT chunk (simple, non-compressed)
  const pixelCount = size * size;
  const dataSize = pixelCount * 4 + size; // 4 bytes per pixel (RGBA) + 1 byte filter type per scanline
  
  // Create raw data
  const rawData = Buffer.alloc(dataSize);
  
  let offset = 0;
  // For each scanline
  for (let y = 0; y < size; y++) {
    // Filter type (0 = None)
    rawData[offset++] = 0;
    
    // RGBA values for each pixel in the scanline
    for (let x = 0; x < size; x++) {
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }
  
  // Create a very simple PNG with just IHDR and IEND chunks
  const pngData = Buffer.concat([
    signature,
    ihdrLength,
    ihdrType,
    ihdrData,
    Buffer.alloc(4), // CRC, not computed correctly for simplicity
    Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]) // IEND chunk
  ]);
  
  return pngData;
}

// Create logos of different sizes
const logoColor = '#6200EA'; // Primary color

// Create and save 192x192 logo
fs.writeFileSync('logo192.png', createSimplePNG(192, logoColor));
console.log('Created logo192.png');

// Create and save 512x512 logo
fs.writeFileSync('logo512.png', createSimplePNG(512, logoColor));
console.log('Created logo512.png');

// Create and save 32x32 favicon (very simplified)
fs.writeFileSync('favicon.ico', createSimplePNG(32, logoColor));
console.log('Created favicon.ico (as PNG)');