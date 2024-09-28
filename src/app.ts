import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Upload from './queue2';
import UploadV3Router from './router/upload.v3';
import appconfig from './appconfig';

const app = express();
const upload = multer({ dest: appconfig.uploadPath });
app.use('/v3', UploadV3Router)
app.post('/upload/v1', upload.single('video'), async (req, res) => {
    const outputDir = `uploads/hls/${req.file?.filename}`;
    const upload = new Upload(req, {
        outputDir: outputDir,
    })
    const response = await upload.uploadNow()
    res.status(200).send(response)
    upload.queue()
})

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
    res.sendfile('public/index.html');
})
app.use('/hls', express.static(appconfig.uploadPath + '/hls'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});