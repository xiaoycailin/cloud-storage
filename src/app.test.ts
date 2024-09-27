import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs-extra'
import multer from 'multer'
import axios from 'axios'

const app = express()
const PORT = process.env.PORT || 3000
const UPLOAD_DIR = path.join(__dirname, 'uploads').replace('\\src\\', '\\');
console.log(UPLOAD_DIR);
app.use(cors({
    origin: ''
}))


// Buat direktori uploads jika belum ada
fs.ensureDirSync(UPLOAD_DIR);

// Konfigurasi multer untuk menangani chunk upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Endpoint untuk menerima chunk upload
app.post('/upload', upload.single('chunk'), async (req, res) => {
    const { chunkIndex, totalChunks, videoId } = req.body;

    console.log(`Menerima chunk ${chunkIndex} dari total ${totalChunks} untuk video ${videoId}`);

    // Cek apakah request berhasil
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const chunkFilePath = path.join(UPLOAD_DIR, `${videoId}-chunk-${chunkIndex}`);

    // Simpan chunk ke file sistem
    await fs.writeFile(chunkFilePath, req.file.buffer);
    console.log(`Chunk ${chunkIndex} disimpan di ${chunkFilePath}`);

    // Cek apakah semua chunk sudah diupload
    const uploadedChunks = await fs.readdir(UPLOAD_DIR);
    const chunksForVideo = uploadedChunks.filter(filename => filename.startsWith(videoId));

    // console.log({ sama: chunksForVideo.length === totalChunks, chunksForVideo: chunksForVideo.length, totalChunks });
    if (chunksForVideo.length === parseInt(totalChunks)) {
        const compiler = await axios.get('/compile/' + videoId)
        res.send(compiler.data)
    } else {
        res.status(200).json({ message: `Chunk ${chunkIndex} received` });
    }
});

app.post('/upload/chunk/v1', upload.single('chunk'), async (req, res) => {
    const { chunkIndex, totalChunks, videoId } = req.body;

    console.log(`Menerima chunk ${chunkIndex} dari total ${totalChunks} untuk video ${videoId}`);

    // Cek apakah request berhasil
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const dirUpload = path.join(UPLOAD_DIR, videoId)
    fs.ensureDirSync(dirUpload);

    const chunkFilePath = path.join(dirUpload, `chunk-${chunkIndex}.ts`);

    // Simpan chunk ke file sistem
    await fs.writeFile(chunkFilePath, req.file.buffer);
    console.log(`Chunk ${chunkIndex} disimpan di ${chunkFilePath}`);

    res.status(200).json({ message: `Chunk ${chunkIndex} received` });
});

app.post('/upload/chunk/v2', upload.single('chunk'), async (req, res) => {
    const { chunkIndex, totalChunks, videoId } = req.body;

    console.log(`Menerima chunk ${chunkIndex} dari total ${totalChunks} untuk video ${videoId}`);

    // Cek apakah request berhasil
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const dirUpload = path.join(UPLOAD_DIR, videoId, 'chunk');
    const dirplaylist = path.join(UPLOAD_DIR, videoId, 'playlist');
    await fs.ensureDir(dirUpload);
    await fs.ensureDir(dirplaylist);
    const chunkFilePath = path.join(dirUpload, `chunk-${chunkIndex}.ts`);

    // Simpan chunk ke file sistem
    await fs.promises.writeFile(chunkFilePath, req.file.buffer);
    console.log(`Chunk ${chunkIndex} disimpan di ${chunkFilePath}`);

    // Cek apakah semua chunk telah diterima
    const uploadedChunks = await fs.promises.readdir(dirUpload);
    const chunksForVideo = uploadedChunks.filter(filename => filename.startsWith('chunk'));

    if (chunksForVideo.length === parseInt(totalChunks)) {
        console.log(`Semua chunk untuk video ${videoId} telah diupload. Membuat playlist...`);

        // Buat file playlist M3U8
        const playlistFilePath = path.join(dirplaylist, `playlist.m3u8`);
        let playlistContent = `#EXTM3U\n#EXT-X-VERSION:3\n`;

        // Tambahkan setiap chunk ke playlist
        for (let i = 0; i < totalChunks; i++) {
            playlistContent += `#EXTINF:5.0,\n${req.protocol}://${req.host}:${req.socket.localPort}/m3u8/${videoId}/chunk/chunk-${i}.ts\n`;
        }
        playlistContent += '#EXT-X-ENDLIST';

        // Simpan playlist ke file sistem
        await fs.promises.writeFile(playlistFilePath, playlistContent);
        console.log(`Playlist ${videoId}.m3u8 dibuat.`);

        const compiler = await axios.get(`${req.protocol}://${req.host}:${req.socket.localPort}/compile/${videoId}`)

        res.status(200).json({ message: 'Upload complete', playlistUrl: `/m3u8/${videoId}.m3u8`, compiler: compiler.data });
    } else {
        res.status(200).json({ message: `Chunk ${chunkIndex} received` });
    }
});

app.get('/m3u8/:videoId/playlist/playlist.m3u8', (req, res) => {
    const filePath = path.join(UPLOAD_DIR, req.params.videoId, 'playlist', 'playlist.m3u8');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.sendFile(filePath);
});


app.get('/m3u8/:videoId/chunk/:chunkId', (req, res) => {
    const filePath = path.join(UPLOAD_DIR, req.params.videoId, 'chunk', req.params.chunkId)
    res.setHeader('Content-Type', 'video/mp2t')
    res.sendFile(filePath)
});

app.get('/compile/:videoId', async (req, res) => {
    const videoId = req.params.videoId;
    const dirUpload = path.join(UPLOAD_DIR, videoId, 'chunk');
    const chunksForVideo = await fs.promises.readdir(dirUpload);
    const totalChunks = chunksForVideo.length;

    // Pastikan ada chunk yang tersedia
    if (totalChunks === 0) {
        return res.status(400).json({ message: 'No chunks available for this video.' });
    }

    const compileDir = path.join(UPLOAD_DIR, videoId, 'compile');
    fs.ensureDirSync(compileDir);

    const finalFilePath = path.join(compileDir, 'video.mp4');
    console.log(`Menggabungkan chunk untuk video ${videoId}`);

    const writeStream = fs.createWriteStream(finalFilePath);

    // Menggabungkan chunk
    for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(dirUpload, `chunk-${i}.ts`);
        try {
            const chunkData = await fs.promises.readFile(chunkPath);
            writeStream.write(chunkData);
            console.log(`Chunk ${i} ditambahkan ke file ${finalFilePath}`);
        } catch (error) {
            console.error(`Error reading chunk ${i}:`, error);
            return res.status(500).json({ message: `Error reading chunk ${i}` });
        }
    }

    writeStream.end();

    writeStream.on('finish', async () => {
        console.log(`File ${videoId}.mp4 selesai digabungkan.`);

        // Opsional: Hapus chunk setelah penggabungan
        // for (let i = 0; i < totalChunks; i++) {
        //     await fs.promises.unlink(path.join(dirUpload, `chunk-${i}.ts`));
        // }

        res.status(200).json({ message: 'Upload complete', videoUrl: `/uploads/${videoId}/compile/video.mp4` });
    });

    writeStream.on('error', (err) => {
        console.error('Error while writing file:', err);
        res.status(500).json({ message: 'Error while writing file' });
    });
});


app.get('/', (req, res) => {
    res.sendfile('D:/proxy-dailymotion/public/index.html');
})

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`)
})
