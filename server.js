const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const { Dropbox, DropboxAuth } = require("dropbox");
const fetch = require("node-fetch");

const app = express();
const PORT = 5001;
const FILE_PATH = "./books.json";

// Load books from JSON file
let booksDB = {};
if (fs.existsSync(FILE_PATH)) {
  booksDB = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
}

const saveBooks = () => {
  fs.writeFileSync(FILE_PATH, JSON.stringify(booksDB, null, 2));
};

app.use(cors({ origin: "https://www.drnimbs.com" }));
app.use(express.json());

// Dropbox Credentials
const DROPBOX_CLIENT_ID = "tu2of2p7m1yhiqc";
const DROPBOX_CLIENT_SECRET = "0mkhxpvhacuri0o";
const DROPBOX_REFRESH_TOKEN = "ddf81hxCVTEAAAAAAAAAAU3bWaRIkwDHzak4UufwdYttDb3_LzRUPEjsdabVK1bM";

// Get a fresh Dropbox Access Token
const getAccessToken = async () => {
  const auth = new DropboxAuth({ clientId: DROPBOX_CLIENT_ID, clientSecret: DROPBOX_CLIENT_SECRET });
  auth.setRefreshToken(DROPBOX_REFRESH_TOKEN);
  await auth.refreshAccessToken();
  return auth.getAccessToken();
};

// Multer: Store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload file to Dropbox
const uploadFileToDropbox = async (file) => {
  try {
    const accessToken = await getAccessToken();
    const dbx = new Dropbox({ accessToken, fetch });

    const uploadResponse = await dbx.filesUpload({
      path: `/${file.originalname}`,
      contents: file.buffer,
      mode: { ".tag": "overwrite" },
    });

    // Check if shared link exists
    let sharedLinkResponse = await dbx.sharingListSharedLinks({ path: uploadResponse.result.path_display });

    if (sharedLinkResponse.result.links.length > 0) {
      return sharedLinkResponse.result.links[0].url.replace("&dl=0", "&raw=1");
    }

    // Create a new shared link
    sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({ path: uploadResponse.result.path_display });
    return sharedLinkResponse.result.url.replace("&dl=0", "&raw=1");
  } catch (error) {
    console.error("Dropbox upload error:", error);
    throw new Error("Failed to upload file to Dropbox: " + error.message);
  }
};

// 📌 GET route to fetch a book by ID
app.get("/upload/:id", (req, res) => {
  const { id } = req.params;
  if (!booksDB[id]) {
    return res.status(404).json({ success: false, message: "Book not found" });
  }
  return res.json({ success: true, book: booksDB[id] });
});

// 📌 POST route to upload a book
app.post("/upload", upload.fields([{ name: "bookLink" }, { name: "bookDocument" }]), async (req, res) => {
  try {
    if (!req.files || (!req.files.bookLink && !req.files.bookDocument)) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const bookID = Date.now().toString();
    const uploadPromises = [];

    if (req.files.bookLink) uploadPromises.push(uploadFileToDropbox(req.files.bookLink[0]));
    if (req.files.bookDocument) uploadPromises.push(uploadFileToDropbox(req.files.bookDocument[0]));

    const uploadedFiles = await Promise.all(uploadPromises);

    booksDB[bookID] = {
      bookLink: uploadedFiles[0] || null,
      bookDocument: uploadedFiles[1] || null,
      title: req.body.title || "",
      description: req.body.description || "",
    };

    saveBooks();

    return res.json({
      success: true,
      message: "Book uploaded successfully!",
      bookID,
      ...booksDB[bookID],
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ success: false, message: "Upload failed.", error: error.message });
  }
});

// 📌 PATCH route to update book
app.patch("/upload/:id", upload.fields([{ name: "bookLink" }, { name: "bookDocument" }]), async (req, res) => {
  const { id } = req.params;
  if (!booksDB[id]) {
    return res.status(404).json({ success: false, message: "Book not found" });
  }

  try {
    const uploadPromises = [];
    if (req.files?.bookLink) uploadPromises.push(uploadFileToDropbox(req.files.bookLink[0]));
    if (req.files?.bookDocument) uploadPromises.push(uploadFileToDropbox(req.files.bookDocument[0]));

    const uploadedFiles = await Promise.all(uploadPromises);

    if (req.files?.bookLink) booksDB[id].bookLink = uploadedFiles[0];
    if (req.files?.bookDocument) booksDB[id].bookDocument = uploadedFiles[1];

    if (req.body.title) booksDB[id].title = req.body.title;
    if (req.body.description) booksDB[id].description = req.body.description;

    saveBooks();

    return res.json({ success: true, message: "Book updated successfully", updatedBook: booksDB[id] });
  } catch (error) {
    console.error("Update error:", error);
    return res.status(500).json({ success: false, message: "Update failed.", error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
