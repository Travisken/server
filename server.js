const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { Dropbox, DropboxAuth } = require("dropbox");
const fetch = require("node-fetch"); // Ensure fetch is available

const app = express();
const PORT = 5001;

// Enable CORS for frontend communication
app.use(cors({
  // origin: 'http://localhost:3000', // Update to your frontend URL
  origin: 'https://www.drnimbs.com', // Update to your frontend URL
}));

// Dropbox OAuth credentials
const DROPBOX_CLIENT_ID = "tu2of2p7m1yhiqc";
const DROPBOX_CLIENT_SECRET = "0mkhxpvhacuri0o";
const DROPBOX_REFRESH_TOKEN = "ddf81hxCVTEAAAAAAAAAAU3bWaRIkwDHzak4UufwdYttDb3_LzRUPEjsdabVK1bM";

// Function to get a fresh access token
const getAccessToken = async () => {
  try {
    const auth = new DropboxAuth({
      clientId: DROPBOX_CLIENT_ID,
      clientSecret: DROPBOX_CLIENT_SECRET,
    });

    auth.setRefreshToken(DROPBOX_REFRESH_TOKEN);
    console.log("Refreshing Dropbox access token...");

    await auth.refreshAccessToken();
    const newAccessToken = await auth.getAccessToken(); // Await this call

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

// Multer: Memory storage for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to upload a file and get a permanent shareable link
const uploadFileToDropbox = async (file) => {
  try {
    const accessToken = await getAccessToken();
    const dbx = new Dropbox({ accessToken, fetch });

    console.log("Uploading file to Dropbox:", file.originalname);

    // Upload file (overwrite mode)
    const uploadResponse = await dbx.filesUpload({
      path: `/${file.originalname}`,
      contents: file.buffer,
      mode: { ".tag": "overwrite" },
    });

    console.log("Upload response:", uploadResponse.result);

    // Check if a shared link already exists
    let sharedLinkResponse = await dbx.sharingListSharedLinks({ path: uploadResponse.result.path_display });

    if (sharedLinkResponse.result.links.length > 0) {
      const existingLink = sharedLinkResponse.result.links[0].url.replace("&dl=0", "&raw=1");
      console.log("Shared link already exists:", existingLink);
      return existingLink; // Return existing link immediately
    }

    // Generate a new shareable link if none exists
    sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
      path: uploadResponse.result.path_display,
    });

    const newLink = sharedLinkResponse.result.url.replace(/(\&dl=0)?$/, "&raw=1");
    console.log("Generated new shared link:", newLink);
    return newLink;
  } catch (error) {
    console.error("Dropbox upload error:", error);

    // Handle shared link conflict (409 error)
    if (error.status === 409 && error.error?.error_summary.startsWith("shared_link_already_exists")) {
      console.log("Shared link conflict. Fetching existing link...");
      try {
        const existingLinks = await dbx.sharingListSharedLinks({ path: `/${file.originalname}` });

        if (existingLinks.result.links.length > 0) {
          return existingLinks.result.links[0].url.replace("&dl=0", "&raw=1");
        }
      } catch (err) {
        console.error("Error retrieving existing shared link:", err);
      }
    }

    throw new Error("Failed to upload file to Dropbox: " + error.message);
  }
};

// Upload route for cover images and book documents
app.post("/upload", upload.fields([{ name: "bookLink" }, { name: "bookDocument" }]), async (req, res) => {
  try {
    if (!req.files || (!req.files.bookLink && !req.files.bookDocument)) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    // Upload files to Dropbox
    const uploadPromises = [];
    if (req.files.bookLink) uploadPromises.push(uploadFileToDropbox(req.files.bookLink[0]));
    if (req.files.bookDocument) uploadPromises.push(uploadFileToDropbox(req.files.bookDocument[0]));

    // Wait for all uploads and retrieve URLs
    const uploadedFiles = await Promise.all(uploadPromises);
    const response = {
      success: true,
      message: "Files uploaded successfully!",
    };

    if (req.files.bookLink) response.bookLink = uploadedFiles[0];
    if (req.files.bookDocument) response.bookDocument = uploadedFiles[1];

    // Send response with success message
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