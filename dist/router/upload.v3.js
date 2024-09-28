"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_extra_1 = __importDefault(require("fs-extra"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const express_2 = __importDefault(require("express"));
const VideoCompressor_1 = __importDefault(require("../services/VideoCompressor"));
const queue2_1 = __importDefault(require("../queue2"));
const appconfig_1 = __importDefault(require("../appconfig"));
const UPLOAD_DIR = path_1.default.join(appconfig_1.default.uploadPath);
const router = (0, express_1.Router)();
fs_extra_1.default.ensureDirSync(UPLOAD_DIR);
const compressor = new VideoCompressor_1.default(UPLOAD_DIR);
// Konfigurasi multer untuk menangani chunk upload
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
router.post("/upload/v3", upload.single("chunk"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { chunkIndex, totalChunks, videoId, fileName } = req.body;
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }
    const VideoMetdata = {
        id: videoId,
        fileName,
        mimtype: (_a = req.file) === null || _a === void 0 ? void 0 : _a.mimetype,
    };
    const cahceFile = path_1.default.join(UPLOAD_DIR, "chunk", videoId);
    fs_extra_1.default.ensureDirSync(cahceFile);
    const chunkFilePath = path_1.default.join(cahceFile, `index${chunkIndex}.ts`);
    // Simpan chunk ke file sistem
    yield fs_extra_1.default.writeFile(chunkFilePath, req.file.buffer);
    // Cek apakah semua chunk sudah diupload
    const uploadedChunks = yield fs_extra_1.default.readdir(cahceFile);
    // lakukan konversi ke mp4 jika sudah selesai
    if (uploadedChunks.length === parseInt(totalChunks)) {
        const pth = yield compressor.toMp4(videoId);
        console.log({ pth });
        queue2_1.default.toHls(pth, path_1.default.join(UPLOAD_DIR, "hls", videoId), videoId);
        res.send({ pth });
    }
    else {
        res.status(200).json({ message: `Chunk ${chunkIndex} received` });
    }
}));
// router.get("/hls/*", (req, res) => {
//     res.send(req.path)
//     // express.static(appconfig.uploadPath + '/hls')
// });
router.use("/hlsv2/:resolution", (req, res, next) => {
    express_2.default.static(`${appconfig_1.default.uploadPath}/hls/${req.params.resolution}`)(req, res, next);
});
const UploadV3Router = router;
exports.default = UploadV3Router;
