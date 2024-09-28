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
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const multer_1 = __importDefault(require("multer"));
const axios_1 = __importDefault(require("axios"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path_1.default.join(__dirname, 'uploads', 'chunks').replace('\\src\\', '\\');
// console.log(UPLOAD_DIR);
app.use((0, cors_1.default)({
    origin: ''
}));
// Buat direktori uploads jika belum ada
fs_extra_1.default.ensureDirSync(UPLOAD_DIR);
// Konfigurasi multer untuk menangani chunk upload
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
// Endpoint untuk menerima chunk upload
app.post('/upload', upload.single('chunk'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { chunkIndex, totalChunks, videoId } = req.body;
    console.log(`Menerima chunk ${chunkIndex} dari total ${totalChunks} untuk video ${videoId}`);
    // Cek apakah request berhasil
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const chunkFilePath = path_1.default.join(UPLOAD_DIR, `${videoId}-chunk-${chunkIndex}`);
    // Simpan chunk ke file sistem
    yield fs_extra_1.default.writeFile(chunkFilePath, req.file.buffer);
    console.log(`Chunk ${chunkIndex} disimpan di ${chunkFilePath}`);
    // Cek apakah semua chunk sudah diupload
    const uploadedChunks = yield fs_extra_1.default.readdir(UPLOAD_DIR);
    const chunksForVideo = uploadedChunks.filter(filename => filename.startsWith(videoId));
    // console.log({ sama: chunksForVideo.length === totalChunks, chunksForVideo: chunksForVideo.length, totalChunks });
    if (chunksForVideo.length === parseInt(totalChunks)) {
        const compiler = yield axios_1.default.get('/compile/' + videoId);
        res.send(compiler.data);
    }
    else {
        res.status(200).json({ message: `Chunk ${chunkIndex} received` });
    }
}));
app.post('/upload/chunk/v1', upload.single('chunk'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { chunkIndex, totalChunks, videoId } = req.body;
    console.log(`Menerima chunk ${chunkIndex} dari total ${totalChunks} untuk video ${videoId}`);
    // Cek apakah request berhasil
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const dirUpload = path_1.default.join(UPLOAD_DIR, videoId);
    fs_extra_1.default.ensureDirSync(dirUpload);
    const chunkFilePath = path_1.default.join(dirUpload, `chunk-${chunkIndex}.ts`);
    // Simpan chunk ke file sistem
    yield fs_extra_1.default.writeFile(chunkFilePath, req.file.buffer);
    console.log(`Chunk ${chunkIndex} disimpan di ${chunkFilePath}`);
    res.status(200).json({ message: `Chunk ${chunkIndex} received` });
}));
app.post('/upload/chunk/v2', upload.single('chunk'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { chunkIndex, totalChunks, videoId } = req.body;
    console.log(`Menerima chunk ${chunkIndex} dari total ${totalChunks} untuk video ${videoId}`);
    // Cek apakah request berhasil
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const dirUpload = path_1.default.join(UPLOAD_DIR, videoId, 'chunk');
    const dirplaylist = path_1.default.join(UPLOAD_DIR, videoId, 'playlist');
    yield fs_extra_1.default.ensureDir(dirUpload);
    yield fs_extra_1.default.ensureDir(dirplaylist);
    const chunkFilePath = path_1.default.join(dirUpload, `chunk-${chunkIndex}.ts`);
    // Simpan chunk ke file sistem
    yield fs_extra_1.default.promises.writeFile(chunkFilePath, req.file.buffer);
    console.log(`Chunk ${chunkIndex} disimpan di ${chunkFilePath}`);
    // Cek apakah semua chunk telah diterima
    const uploadedChunks = yield fs_extra_1.default.promises.readdir(dirUpload);
    const chunksForVideo = uploadedChunks.filter(filename => filename.startsWith('chunk'));
    if (chunksForVideo.length === parseInt(totalChunks)) {
        console.log(`Semua chunk untuk video ${videoId} telah diupload. Membuat playlist...`);
        // Buat file playlist M3U8
        const playlistFilePath = path_1.default.join(dirplaylist, `playlist.m3u8`);
        let playlistContent = `#EXTM3U\n#EXT-X-VERSION:3\n`;
        // Tambahkan setiap chunk ke playlist
        for (let i = 0; i < totalChunks; i++) {
            playlistContent += `#EXTINF:5.0,\n${req.protocol}://${req.host}:${req.socket.localPort}/m3u8/${videoId}/chunk/chunk-${i}.ts\n`;
        }
        playlistContent += '#EXT-X-ENDLIST';
        // Simpan playlist ke file sistem
        yield fs_extra_1.default.promises.writeFile(playlistFilePath, playlistContent);
        console.log(`Playlist ${videoId}.m3u8 dibuat.`);
        const compiler = yield axios_1.default.get(`${req.protocol}://${req.host}:${req.socket.localPort}/compile/${videoId}`);
        res.status(200).json({ message: 'Upload complete', playlistUrl: `/m3u8/${videoId}.m3u8`, compiler: compiler.data });
    }
    else {
        res.status(200).json({ message: `Chunk ${chunkIndex} received` });
    }
}));
app.get('/m3u8/:videoId/playlist/playlist.m3u8', (req, res) => {
    const filePath = path_1.default.join(UPLOAD_DIR, req.params.videoId, 'playlist', 'playlist.m3u8');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.sendFile(filePath);
});
app.get('/m3u8/:videoId/chunk/:chunkId', (req, res) => {
    const filePath = path_1.default.join(UPLOAD_DIR, req.params.videoId, 'chunk', req.params.chunkId);
    res.setHeader('Content-Type', 'video/mp2t');
    res.sendFile(filePath);
});
app.get('/compile/:videoId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const videoId = req.params.videoId;
    const dirUpload = path_1.default.join(UPLOAD_DIR, videoId, 'chunk');
    const chunksForVideo = yield fs_extra_1.default.promises.readdir(dirUpload);
    const totalChunks = chunksForVideo.length;
    // Pastikan ada chunk yang tersedia
    if (totalChunks === 0) {
        return res.status(400).json({ message: 'No chunks available for this video.' });
    }
    const compileDir = path_1.default.join(UPLOAD_DIR, videoId, 'compile');
    fs_extra_1.default.ensureDirSync(compileDir);
    const finalFilePath = path_1.default.join(compileDir, 'video.mp4');
    console.log(`Menggabungkan chunk untuk video ${videoId}`);
    const writeStream = fs_extra_1.default.createWriteStream(finalFilePath);
    // Menggabungkan chunk
    for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path_1.default.join(dirUpload, `chunk-${i}.ts`);
        try {
            const chunkData = yield fs_extra_1.default.promises.readFile(chunkPath);
            writeStream.write(chunkData);
            console.log(`Chunk ${i} ditambahkan ke file ${finalFilePath}`);
        }
        catch (error) {
            console.error(`Error reading chunk ${i}:`, error);
            return res.status(500).json({ message: `Error reading chunk ${i}` });
        }
    }
    writeStream.end();
    writeStream.on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
        console.log(`File ${videoId}.mp4 selesai digabungkan.`);
        // Opsional: Hapus chunk setelah penggabungan
        // for (let i = 0; i < totalChunks; i++) {
        //     await fs.promises.unlink(path.join(dirUpload, `chunk-${i}.ts`));
        // }
        res.status(200).json({ message: 'Upload complete', videoUrl: `/uploads/${videoId}/compile/video.mp4` });
    }));
    writeStream.on('error', (err) => {
        console.error('Error while writing file:', err);
        res.status(500).json({ message: 'Error while writing file' });
    });
}));
app.get('/', (req, res) => {
    res.sendfile('D:/proxy-dailymotion/public/index.html');
});
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
