const fs = require('fs');
const path = require('path');

// Copy WASM files from @mysten/walrus to public folder
const sourceDir = path.join(__dirname, '../node_modules/@mysten/walrus/dist');
const targetDir = path.join(__dirname, '../public/wasm');

if (fs.existsSync(sourceDir)) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const wasmFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.wasm'));
  wasmFiles.forEach(file => {
    fs.copyFileSync(
      path.join(sourceDir, file),
      path.join(targetDir, file)
    );
    console.log(`Copied ${file}`);
  });
}