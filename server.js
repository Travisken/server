const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { Dropbox } = require("dropbox");

const app = express();
const PORT = 5001;

// Enable CORS for frontend communication
app.use(cors({
  origin: 'https://www.drnimbs.com', // Update to your frontend URL
}));

// Dropbox OAuth credentials
const DROPBOX_CLIENT_ID = "tu2of2p7m1yhiqc";
const DROPBOX_CLIENT_SECRET = "0mkhxpvhacuri0o";
const DROPBOX_REFRESH_TOKEN = "ddf81hxCVTEAAAAAAAAAAU3bWaRIkwDHzak4UufwdYttDb3_LzRUPEjsdabVK1bM";

// Function to get a fresh access token
const getAccessToken = async () => {
  try {
    const dbx = new Dropbox({ clientId: DROPBOX_CLIENT_ID, clientSecret: DROPBOX_CLIENT_SECRET });
    const response = await dbx.auth.tokenFromRefreshToken(DROPBOX_REFRESH_TOKEN);
    return response.result.access_token;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw new Error("Failed to refresh Dropbox access token");
  }
};

// Multer: Memory storage for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to upload a file and get a permanent shareable link
const uploadFileToDropbox = async (file) => {
  try {
    const accessToken = await getAccessToken();
    const dbx = new Dropbox({ accessToken });

    // Upload file to Dropbox
    const uploadResponse = await dbx.filesUpload({
      path: `/${file.originalname}`,
      contents: file.buffer,
    });

    // Create a permanent shared link
    let sharedLinkResponse;
    try {
      sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
        path: uploadResponse.result.path_display,
      });
    } catch (error) {
      // If a link already exists, retrieve it instead of creating a new one
      if (error.status === 409) {
        sharedLinkResponse = await dbx.sharingListSharedLinks({ path: uploadResponse.result.path_display });
        if (sharedLinkResponse.result.links.length > 0) {
          return sharedLinkResponse.result.links[0].url.replace("?dl=0", "?raw=1");
        }
      }
      throw error;
    }

    return sharedLinkResponse.result.url.replace("?dl=0", "?raw=1"); // Convert link to direct download
  } catch (error) {
    console.error("Dropbox upload error:", error);
    throw new Error("Failed to upload file to Dropbox");
  }
};

// Upload route for cover images and book documents
app.post("/upload", upload.fields([{ name: "bookLink" }, { name: "bookDocument" }]), async (req, res) => {
  try {
    if (!req.files) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Upload files to Dropbox
    const uploadPromises = [];
    if (req.files.bookLink) uploadPromises.push(uploadFileToDropbox(req.files.bookLink[0]));
    if (req.files.bookDocument) uploadPromises.push(uploadFileToDropbox(req.files.bookDocument[0]));

    // Wait for all uploads and retrieve URLs
    const [bookLink, bookDocument] = await Promise.all(uploadPromises);

    res.json({ bookLink, bookDocument });
  } catch (error) {
    console.error("Error during upload process:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
