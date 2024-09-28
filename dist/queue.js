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
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class Upload {
    constructor(req, options) {
        this.req = req;
        this.outputDir = options.outputDir;
        // Buat direktori output untuk menyimpan file HLS
        if (!fs_1.default.existsSync(this.outputDir)) {
            fs_1.default.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    // Mendapatkan informasi video (termasuk resolusi asli)
    getVideoInfo(inputFilePath) {
        return new Promise((resolve, reject) => {
            const ffprobeCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${inputFilePath}`;
            (0, child_process_1.exec)(ffprobeCommand, (error, stdout, stderr) => {
                if (error) {
                    return reject(new Error(`Failed to get video info: ${stderr}`));
                }
                const [width, height] = stdout.trim().split(",").map(Number);
                const aspectRatio = (width / height).toFixed(2); // Mendapatkan aspect ratio dalam dua desimal
                resolve({ width, height, aspectRatio });
            });
        });
    }
    filterSupportedResolutions(originalHeight) {
        return Upload.availableResolutions.filter((res) => res <= originalHeight);
    }
    getCommand(resolution, inputFilePath, aspectRatio) {
        const resolutionConfig = Upload.resolutions.find((r) => r.height === resolution);
        if (!resolutionConfig) {
            throw new Error(`Unsupported resolution: ${resolution}`);
        }
        const outputFilePath = path_1.default.join(this.outputDir, `${resolution}p/index.m3u8`);
        // Buat direktori untuk resolusi jika belum ada
        if (!fs_1.default.existsSync(path_1.default.dirname(outputFilePath))) {
            fs_1.default.mkdirSync(path_1.default.dirname(outputFilePath), { recursive: true });
        }
        let scaleFilter;
        // Cek apakah aspect ratio mendekati 9:16
        if (Math.abs(parseFloat(aspectRatio) - 9 / 16) < 0.01) {
            // Jika aspect ratio 9:16, sesuaikan lebar secara otomatis
            scaleFilter = `scale=-1:${resolutionConfig.height}`;
        }
        else {
            // Jika aspect ratio bukan 9:16, sesuaikan tinggi dengan resolusi yang ditentukan
            scaleFilter = `scale=${resolutionConfig.width}:${resolutionConfig.height}`;
        }
        const ffmpegCommand = `ffmpeg -i ${inputFilePath} -vf "${scaleFilter}" -c:v libx264 -preset veryfast -crf 23 -c:a aac -strict -2 -b:a 128k -start_number 0 -hls_time 10 -hls_list_size 0 -f hls ${outputFilePath}`;
        return ffmpegCommand;
    }
    queue() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const inputFilePath = (_a = this.req.file) === null || _a === void 0 ? void 0 : _a.path;
            if (!inputFilePath) {
                throw new Error("No video file uploaded.");
            }
            const { height: originalHeight, aspectRatio } = yield this.getVideoInfo(inputFilePath);
            let supportedResolutions = this.filterSupportedResolutions(originalHeight);
            // Jika aspect ratio 9:16, filter resolusi berdasarkan resolusi vertikal
            if (aspectRatio === (9 / 16).toFixed(2)) {
                console.log("Aspect ratio is 9:16, using vertical resolutions only.");
                supportedResolutions = supportedResolutions.filter((res) => res <= 720); // Misalnya hanya sampai 720p
            }
            try {
                const uploads = yield Promise.all(supportedResolutions.map((resolution) => __awaiter(this, void 0, void 0, function* () {
                    const upload = yield this.now(resolution);
                    console.log("Uploaded Resolution: " + resolution, upload);
                    return upload;
                })));
                // Tunggu beberapa detik sebelum menghapus file asli
                yield new Promise((resolve) => setTimeout(resolve, 2000)); // Tunggu 2 detik
                // Hapus file asli setelah semua upload selesai
                if (fs_1.default.existsSync(inputFilePath)) {
                    yield fs_1.default.promises.unlink(inputFilePath);
                    console.log("Original file deleted successfully.");
                }
                else {
                    console.log("Original file does not exist, skipping deletion.");
                }
                return uploads; // Kembalikan hasil upload
            }
            catch (error) {
                console.error("Error during upload:", error);
                // Coba menghapus lagi jika terjadi kesalahan
                try {
                    // Memeriksa keberadaan file sebelum menghapus
                    if (fs_1.default.existsSync(inputFilePath)) {
                        yield fs_1.default.promises.unlink(inputFilePath);
                        console.log("Original file deleted successfully (after error).");
                    }
                    else {
                        console.log("Original file does not exist, skipping deletion (after error).");
                    }
                }
                catch (unlinkError) {
                    console.error("Error deleting file after upload error:", unlinkError);
                }
                throw error; // Lemparkan kembali error jika terjadi kesalahan
            }
        });
    }
    uploadNow(resolution = 240) {
        return this.now(resolution);
    }
    now() {
        return __awaiter(this, arguments, void 0, function* (resolution = 240) {
            var _a;
            const inputFilePath = (_a = this.req.file) === null || _a === void 0 ? void 0 : _a.path;
            if (!inputFilePath) {
                throw new Error("No video file uploaded.");
            }
            const info = yield this.getVideoInfo(inputFilePath);
            return new Promise((resolve, reject) => {
                const ffmpegCommand = this.getCommand(resolution, inputFilePath, info.aspectRatio);
                (0, child_process_1.exec)(ffmpegCommand, (error, stdout, stderr) => {
                    var _a, _b;
                    if (error) {
                        console.error(`Error during FFmpeg execution: ${error.message}`);
                        return reject(new Error("Failed to convert video."));
                    }
                    resolve({
                        url: `/hls/${(_a = this.req.file) === null || _a === void 0 ? void 0 : _a.filename}/${resolution}p/index.m3u8`,
                        filename: (_b = this.req.file) === null || _b === void 0 ? void 0 : _b.filename,
                    });
                });
            });
        });
    }
    static uploadFromFile(inputFilePath, outputDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const getVideoInfo = (filePath) => {
                return new Promise((resolve, reject) => {
                    const ffprobeCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${filePath}`;
                    (0, child_process_1.exec)(ffprobeCommand, (error, stdout, stderr) => {
                        if (error) {
                            return reject(new Error(`Failed to get video info: ${stderr}`));
                        }
                        const [width, height] = stdout.trim().split(",").map(Number);
                        resolve({ width, height });
                    });
                });
            };
            const filterSupportedResolutions = (originalHeight) => {
                const availableResolutions = [240, 360, 480, 720, 1080, 1440, 2160];
                return availableResolutions.filter((res) => res <= originalHeight);
            };
            const getCommand = (resolution, filePath) => {
                const resolutions = [
                    { height: 240, width: 426 },
                    { height: 360, width: 640 },
                    { height: 480, width: 854 },
                    { height: 720, width: 1280 },
                    { height: 1080, width: 1920 },
                    { height: 1440, width: 2560 },
                    { height: 2160, width: 3840 },
                ];
                const resolutionConfig = resolutions.find((r) => r.height === resolution);
                if (!resolutionConfig) {
                    throw new Error(`Unsupported resolution: ${resolution}`);
                }
                const outputFilePath = path_1.default.join(outputDir, `${resolution}p/index.m3u8`);
                if (!fs_1.default.existsSync(path_1.default.dirname(outputFilePath))) {
                    fs_1.default.mkdirSync(path_1.default.dirname(outputFilePath), { recursive: true });
                }
                return `ffmpeg -i ${filePath} -vf scale=w=${resolutionConfig.width}:h=${resolutionConfig.height} -c:v libx264 -preset veryfast -crf 23 -c:a aac -strict -2 -b:a 128k -start_number 0 -hls_time 10 -hls_list_size 0 -f hls ${outputFilePath}`;
            };
            const { height: originalHeight } = yield getVideoInfo(inputFilePath);
            try {
                const supportedResolutions = filterSupportedResolutions(originalHeight);
                const uploads = yield Promise.all(supportedResolutions.map((resolution) => __awaiter(this, void 0, void 0, function* () {
                    const ffmpegCommand = getCommand(resolution, inputFilePath);
                    return new Promise((resolve, reject) => {
                        (0, child_process_1.exec)(ffmpegCommand, (error) => {
                            if (error) {
                                return reject(new Error(`Failed to convert video to ${resolution}p`));
                            }
                            resolve({
                                url: `/hls/${path_1.default.basename(inputFilePath)}/${resolution}p/index.m3u8`,
                                filename: path_1.default.basename(inputFilePath),
                            });
                        });
                    });
                })));
                // Hapus file asli setelah konversi selesai
                yield fs_1.default.promises.unlink(inputFilePath);
                return uploads;
            }
            catch (error) {
                yield fs_1.default.promises.unlink(inputFilePath);
                throw new Error(`Error during video conversion: ${error.message}`);
            }
        });
    }
}
Upload.availableResolutions = [240, 360, 480, 720, 1080, 1440, 2160];
Upload.resolutions = [
    { height: 240, width: 426 },
    { height: 360, width: 640 },
    { height: 480, width: 854 },
    { height: 720, width: 1280 },
    { height: 1080, width: 1920 },
    { height: 1440, width: 2560 }, // 1440p (Quad HD)
    { height: 2160, width: 3840 }, // 2160p (4K UHD)
];
exports.default = Upload;
