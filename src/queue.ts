import { Request } from "express";
import { exec } from 'child_process';
import fs from 'fs';
import path from "path";

export interface Resolution {
    width: number;
    height: number;
}

export default class Upload {
    private outputDir: string;

    constructor(private req: Request, options: { outputDir: string; }) {
        this.outputDir = options.outputDir;

        // Buat direktori output untuk menyimpan file HLS
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    // Mendapatkan informasi video (termasuk resolusi asli)
    private getVideoInfo(inputFilePath: string): Promise<Resolution> {
        return new Promise((resolve, reject) => {
            const ffprobeCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${inputFilePath}`;
            exec(ffprobeCommand, (error, stdout, stderr) => {
                if (error) {
                    return reject(new Error(`Failed to get video info: ${stderr}`));
                }
                const [width, height] = stdout.trim().split(',').map(Number);
                resolve({ width, height });
            });
        });
    }

    private filterSupportedResolutions(originalHeight: number): number[] {
        // Daftar resolusi yang didukung, termasuk 1440p dan 2160p (4K)
        const availableResolutions = [240, 360, 480, 720, 1080, 1440, 2160];
        return availableResolutions.filter(res => res <= originalHeight);
    }


    private getCommand(resolution: number, inputFilePath: string): string {
        const resolutions = [
            { height: 240, width: 426 },
            { height: 360, width: 640 },
            { height: 480, width: 854 },
            { height: 720, width: 1280 },
            { height: 1080, width: 1920 },
            { height: 1440, width: 2560 },  // 1440p (Quad HD)
            { height: 2160, width: 3840 },  // 2160p (4K UHD)
        ];

        const resolutionConfig = resolutions.find(r => r.height === resolution);
        if (!resolutionConfig) {
            throw new Error(`Unsupported resolution: ${resolution}`);
        }

        const outputFilePath = path.join(this.outputDir, `${resolution}p/index.m3u8`);

        // Buat direktori untuk resolusi jika belum ada
        if (!fs.existsSync(path.dirname(outputFilePath))) {
            fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
        }

        const ffmpegCommand = `ffmpeg -i ${inputFilePath} -vf scale=w=${resolutionConfig.width}:h=${resolutionConfig.height} -c:v libx264 -preset veryfast -crf 23 -c:a aac -strict -2 -b:a 128k -start_number 0 -hls_time 10 -hls_list_size 0 -f hls ${outputFilePath}`;

        return ffmpegCommand;
    }

    public async queue() {
        const inputFilePath = this.req.file?.path;
        if (!inputFilePath) {
            throw new Error('No video file uploaded.');
        }

        const { height: originalHeight } = await this.getVideoInfo(inputFilePath);
        const supportedResolutions = this.filterSupportedResolutions(originalHeight);

        try {
            const uploads = await Promise.all(supportedResolutions.map(async resolution => {
                const upload = await this.now(resolution);
                console.log('Uploaded Resolution: ' + resolution, upload);
                return upload;
            }));

            // Tunggu beberapa detik sebelum menghapus file asli
            await new Promise(resolve => setTimeout(resolve, 2000)); // Tunggu 2 detik

            // Hapus file asli setelah semua upload selesai
            await fs.promises.unlink(inputFilePath);
            console.log('Original file deleted successfully.');

            return uploads; // Kembalikan hasil upload
        } catch (error) {
            console.error('Error during upload:', error);
            // Coba menghapus lagi jika terjadi kesalahan
            try {
                setTimeout(async () => {
                    fs.promises.unlink(inputFilePath);
                    console.log('Original file deleted successfully (after error).');
                }, 10000);
            } catch (unlinkError) {
                console.error('Error deleting file after upload error:', unlinkError);
            }
            throw error; // Lemparkan kembali error jika terjadi kesalahan
        }
    }

    public uploadNow(resolution: number = 240) {
        return this.now(resolution);
    }

    private now(resolution: number = 240): Promise<{ url: `/hls/${string}/${string}p/index.m3u8`, filename?: string }> {
        const inputFilePath = this.req.file?.path
        if (!inputFilePath) {
            throw new Error('No video file uploaded.')
        }
        return new Promise((resolve, reject) => {
            const ffmpegCommand = this.getCommand(resolution, inputFilePath)
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error during FFmpeg execution: ${error.message}`)
                    return reject(new Error('Failed to convert video.'))
                }
                resolve({ url: `/hls/${this.req.file?.filename}/${resolution}p/index.m3u8`, filename: this.req.file?.filename })
            })
        })
    }

}
