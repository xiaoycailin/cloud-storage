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
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const queue2_1 = __importDefault(require("./queue2"));
const upload_v3_1 = __importDefault(require("./router/upload.v3"));
const appconfig_1 = __importDefault(require("./appconfig"));
const app = (0, express_1.default)();
const upload = (0, multer_1.default)({ dest: '../@storage/uploads/videos' });
app.use('/v3', upload_v3_1.default);
app.post('/upload/v1', upload.single('video'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const outputDir = `uploads/hls/${(_a = req.file) === null || _a === void 0 ? void 0 : _a.filename}`;
    const upload = new queue2_1.default(req, {
        outputDir: outputDir,
    });
    const response = yield upload.uploadNow();
    res.status(200).send(response);
    upload.queue();
}));
// app.post('/upload/v2', upload.single('video'), (req, res) => {
//     if (!req.file) {
//         return res.status(400).json({ error: 'File video tidak ditemukan' });
//     }
//     const videoPath = req.file.path;
//     const fileName = path.basename(videoPath, path.extname(videoPath));
//     const outputDir = path.join('uploads/hls', fileName);
//     // Buat direktori output jika belum ada
//     fs.mkdirSync(outputDir, { recursive: true });
//     const resolutions = ['240']; // Resolusi yang diinginkan
//     const conversionPromises = resolutions.map(resolution => {
//         return new Promise((resolve, reject) => {
//             ffmpeg(videoPath)
//                 .outputOptions([
//                     '-hls_time 10', // Durasi segmen
//                     '-hls_list_size 0', // Semua segmen akan dimasukkan dalam playlist
//                     '-f hls', // Format output
//                 ])
//                 .output(path.join(outputDir, `output-${resolution}p.m3u8`)) // File playlist HLS
//                 .videoCodec('libx264')
//                 .audioCodec('aac')
//                 .size(`${resolution}x?`) // Ukuran untuk resolusi yang berbeda
//                 .on('end', () => {
//                     console.log(`Konversi ke ${resolution}p selesai.`);
//                     resolve(`output-${resolution}p.m3u8`);
//                 })
//                 .on('error', (err: any) => {
//                     console.error(`Terjadi kesalahan saat mengonversi ke ${resolution}p:`, err);
//                     reject(err);
//                 })
//                 .run();
//         });
//     });
//     '/home/ubuntu/project/test-node/cloud-storage/public/index.html'
//     Promise.all(conversionPromises)
//         .then(results => {
//             res.json({ message: 'Video berhasil dikonversi ke HLS', outputs: results })
//         })
//         .catch(err => {
//             res.status(500).json({ error: 'Terjadi kesalahan saat mengonversi video', details: err.message })
//         })
// })
app.get('/', (req, res) => {
    res.sendfile('D:/proxy-dailymotion/public/index.html');
});
app.use('/hls', express_1.default.static(appconfig_1.default.uploadPath + '/hls'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
