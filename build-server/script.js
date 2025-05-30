const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types");
require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.ACCESS_ID,
    secretAccessKey: process.env.SECRET_KEY,
  },
});
const PROJECT_ID = process.env.PROJECT_ID || "123";
async function init() {
  console.log("Excuting build-server script...");
  const outDir = path.join(__dirname, "output");
  const process = exec(`cd ${outDir} && npm install npm run build`);
  process.stdout.on("data", (data) => {
    console.log(data.toString());
  });
  process.stdout.on("error", (error) => {
    console.error("Error:", error.toString());
  });
  process.on("close", async () => {
    console.log("Build completed successfully.");
    const distFolder = path.join(outDir, "dist");
    const distFolderFiles = fs.readdirSync(distFolder, { recursive: true });
    for (const filePath of distFolderFiles) {
      if (fs.lstatSync(filePath).isDirectory()) {
        continue;
      }
      console.log(`Uploading ${filePath} to S3...`);
      const command = new PutObjectCommand({
        Bucket: "rome-v1",
        Key: `__outputs/${PROJECT_ID}/${filePath}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath) || "application/octet-stream",
      });
      await s3Client.send(command);
      console.log(`Uploaded ${filePath} to S3 successfully.`);
    }
    console.log("All files uploaded to S3 successfully.");
  });
}
