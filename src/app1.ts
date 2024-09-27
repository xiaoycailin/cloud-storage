import express, { Request, Response } from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const app = express();
const upload = multer({ dest: 'uploads/' });

// Route untuk upload video dan konversi ke HLS
app.post('/upload', upload.single('video'), (req: Request, res: Response) => {
    const inputFilePath = req.file?.path;
    if (!inputFilePath) {
        return res.status(400).send('No video file uploaded.');
    }

    const outputDir = `uploads/hls/${req.file?.filename}`;

    // Buat direktori output untuk menyimpan file HLS
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFilePath = path.join(outputDir, 'index.m3u8');

    // Perintah untuk konversi video ke HLS menggunakan FFmpeg
    const ffmpegCommand = `ffmpeg -i ${inputFilePath} -codec: copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls ${outputFilePath}`;

    exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error during FFmpeg conversion: ${error.message}`);
            return res.status(500).send('Failed to convert video to HLS.');
        }

        // Kirim URL HLS (.m3u8) ke client
        res.json({ url: `/hls/${req.file?.filename}/index.m3u8` });
    });
});

// Static route untuk mengakses file HLS
app.use('/hls', express.static('uploads/hls'));

app.get('/', (req, res) => {
    res.sendfile('D:/proxy-dailymotion/public/index.html');
})


// Jalankan server
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
