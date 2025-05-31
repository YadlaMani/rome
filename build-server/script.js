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
  try {
    console.log("Executing build-server script...");
    const outDir = path.join(__dirname, "output");

    const buildProcess = exec(`cd ${outDir} && npm install && npm run build`);

    buildProcess.stdout.on("data", (data) => {
      console.log(data.toString());
    });

    buildProcess.stderr.on("data", (data) => {
      console.error("Build Error:", data.toString());
    });

    buildProcess.on("exit", async (code) => {
      if (code !== 0) {
        console.error(`Build process exited with code ${code}`);
        return;
      }

      try {
        console.log("Build completed successfully.");
        const distFolder = path.join(outDir, "dist");

        if (!fs.existsSync(distFolder)) {
          throw new Error(`Dist folder not found at ${distFolder}`);
        }

        const distFolderFiles = fs.readdirSync(distFolder, { recursive: true });

        for (const relativePath of distFolderFiles) {
          const filePath = path.join(distFolder, relativePath);
          if (fs.lstatSync(filePath).isDirectory()) continue;

          console.log(`Uploading ${relativePath} to S3...`);

          const command = new PutObjectCommand({
            Bucket: "rome-v1",
            Key: `__outputs/${PROJECT_ID}/${relativePath.replace(/\\/g, "/")}`,
            Body: fs.createReadStream(filePath),
            ContentType: mime.lookup(filePath) || "application/octet-stream",
          });

          await s3Client.send(command);

          console.log(`Uploaded ${relativePath} to S3 successfully.`);
        }

        console.log("All files uploaded to S3 successfully.");
      } catch (uploadErr) {
        console.error("Upload Error:", uploadErr.message);
        process.exit(1);
      }
    });
  } catch (err) {
    console.error("Initialization Error:", err.message);
    process.exit(1);
  }
}

init();
