"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
const upload = (0, multer_1.default)({ dest: 'uploads/' });
// Route untuk upload video dan konversi ke HLS
app.post('/upload', upload.single('video'), (req, res) => {
    var _a, _b;
    const inputFilePath = (_a = req.file) === null || _a === void 0 ? void 0 : _a.path;
    if (!inputFilePath) {
        return res.status(400).send('No video file uploaded.');
    }
    const outputDir = `uploads/hls/${(_b = req.file) === null || _b === void 0 ? void 0 : _b.filename}`;
    // Buat direktori output untuk menyimpan file HLS
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    const outputFilePath = path_1.default.join(outputDir, 'index.m3u8');
    // Perintah untuk konversi video ke HLS menggunakan FFmpeg
    const ffmpegCommand = `ffmpeg -i ${inputFilePath} -codec: copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls ${outputFilePath}`;
    (0, child_process_1.exec)(ffmpegCommand, (error, stdout, stderr) => {
        var _a;
        if (error) {
            console.error(`Error during FFmpeg conversion: ${error.message}`);
            return res.status(500).send('Failed to convert video to HLS.');
        }
        // Kirim URL HLS (.m3u8) ke client
        res.json({ url: `/hls/${(_a = req.file) === null || _a === void 0 ? void 0 : _a.filename}/index.m3u8` });
    });
});
// Static route untuk mengakses file HLS
app.use('/hls', express_1.default.static('uploads/hls'));
app.get('/', (req, res) => {
    res.sendfile('D:/proxy-dailymotion/public/index.html');
});
// Jalankan server
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
