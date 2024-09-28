import { Router } from "express";
import fs from "fs-extra";
import multer from "multer";
import path from "path";
import express from "express";
import VideoComporessor from "../services/VideoCompressor";
import Upload from "../queue2";
import appconfig from "../appconfig";

const UPLOAD_DIR = path.join(appconfig.uploadPath)
const router = Router();
fs.ensureDirSync(UPLOAD_DIR);
const compressor = new VideoComporessor(UPLOAD_DIR);
// Konfigurasi multer untuk menangani chunk upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload/v3", upload.single("chunk"), async (req, res) => {

    const { chunkIndex, totalChunks, videoId, fileName } = req.body;
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }
    const VideoMetdata = {
        id: videoId,
        fileName,
        mimtype: req.file?.mimetype,
    }

    const cahceFile = path.join(UPLOAD_DIR, "chunk", videoId);
    fs.ensureDirSync(cahceFile);

    const chunkFilePath = path.join(cahceFile, `index${chunkIndex}.ts`);

    // Simpan chunk ke file sistem
    await fs.writeFile(chunkFilePath, req.file.buffer);

    // Cek apakah semua chunk sudah diupload
    const uploadedChunks = await fs.readdir(cahceFile);

    // lakukan konversi ke mp4 jika sudah selesai
    if (uploadedChunks.length === parseInt(totalChunks)) {
        const pth = await compressor.toMp4(videoId);
        console.log({ pth });
        Upload.toHls(pth as string, path.join(UPLOAD_DIR, "hls", videoId), videoId);
        res.send({ pth });
    } else {
        res.status(200).json({ message: `Chunk ${chunkIndex} received` });
    }
});

// router.get("/hls/*", (req, res) => {
//     res.send(req.path)
//     // express.static(appconfig.uploadPath + '/hls')
// });

router.use("/hlsv2/:resolution", (req, res, next) => {
    express.static(`${appconfig.uploadPath}/hls/${req.params.resolution}`)(req, res, next);
});

const UploadV3Router = router;
export default UploadV3Router;
