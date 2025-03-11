const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { Dropbox, DropboxAuth } = require("dropbox");
const fetch = require("node-fetch");

const app = express();
const PORT = 5001;

app.use(cors({
  origin: ['https://www.drnimbs.com', 'http://localhost:3000'], // Update for local development
}));

const DROPBOX_CLIENT_ID = "tu2of2p7m1yhiqc";
const DROPBOX_CLIENT_SECRET = "0mkhxpvhacuri0o";
const DROPBOX_REFRESH_TOKEN = "ddf81hxCVTEAAAAAAAAAAU3bWaRIkwDHzak4UufwdYttDb3_LzRUPEjsdabVK1bM";

const getAccessToken = async () => {
  try {
    const auth = new DropboxAuth({
      clientId: DROPBOX_CLIENT_ID,
      clientSecret: DROPBOX_CLIENT_SECRET,
    });

    auth.setRefreshToken(DROPBOX_REFRESH_TOKEN);
    console.log("Refreshing Dropbox access token...");

    await auth.refreshAccessToken();
    const newAccessToken = await auth.getAccessToken();

    if (!newAccessToken) {
      throw new Error("Dropbox access token is undefined or response is malformed.");
    }

    console.log("New Dropbox access token:", newAccessToken);
    return newAccessToken;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw new Error("Failed to refresh Dropbox access token");
  }
};

const storage = multer.memoryStorage();
const upload = multer({ storage });

const validateFile = (file) => {
  if (!file) return false;
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"]; // Add more as needed
  return allowedTypes.includes(file.mimetype);
};

const uploadFileToDropbox = async (file) => {
  try {
    const accessToken = await getAccessToken();
    const dbx = new Dropbox({ accessToken, fetch });

    console.log("Uploading file to Dropbox:", file.originalname);

    const uploadResponse = await dbx.filesUpload({
      path: `/${file.originalname}`,
      contents: file.buffer,
      mode: { ".tag": "overwrite" },
    });

    console.log("Upload response:", uploadResponse.result);

    let sharedLinkResponse = await dbx.sharingListSharedLinks({ path: uploadResponse.result.path_display });

    if (sharedLinkResponse.result.links.length > 0) {
      const existingLink = sharedLinkResponse.result.links[0].url.replace("?dl=0", "?raw=1");
      console.log("Shared link already exists:", existingLink);
      return existingLink;
    }

    sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
      path: uploadResponse.result.path_display,
    });

    const newLink = sharedLinkResponse.result.url.replace(/(\?dl=0)?$/, "?raw=1");
    console.log("Generated new shared link:", newLink);
    return newLink;
  } catch (error) {
    console.error("Dropbox upload error:", error);

    if (error.status === 409 && error.error?.error_summary.startsWith("shared_link_already_exists")) {
      console.log("Shared link conflict. Fetching existing link...");
      try {
        const existingLinks = await dbx.sharingListSharedLinks({ path: `/${file.originalname}` });

        if (existingLinks.result.links.length > 0) {
          const existingLink = existingLinks.result.links[0].url.replace("?dl=0", "?raw=1");
          console.log("Existing shared link found:", existingLink);
          return existingLink;
        }
      } catch (err) {
        console.error("Error retrieving existing shared link:", err);
      }
    }

    throw new Error("Failed to upload file to Dropbox: " + error.message);
  }
};

app.post("/upload", upload.fields([{ name: "bookLink" }, { name: "bookDocument" }]), async (req, res) => {
  try {
    if (!req.files || (!req.files.bookLink && !req.files.bookDocument)) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    if (req.files.bookLink && !validateFile(req.files.bookLink[0])) {
      return res.status(400).json({ success: false, message: "Invalid file type for bookLink" });
    }

    const uploadPromises = [];
    if (req.files.bookLink) uploadPromises.push(uploadFileToDropbox(req.files.bookLink[0]));
    if (req.files.bookDocument) uploadPromises.push(uploadFileToDropbox(req.files.bookDocument[0]));

    const uploadedFiles = await Promise.all(uploadPromises);
    const response = {
      success: true,
      message: "Files uploaded successfully!",
    };

    if (req.files.bookLink) response.bookLink = uploadedFiles[0];
    if (req.files.bookDocument) response.bookDocument = uploadedFiles[1];

    return res.json(response);
  } catch (error) {
    console.error("Error during upload process:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload files.",
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
