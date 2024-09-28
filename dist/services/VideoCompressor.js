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
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
class VideoCompressor {
    constructor(UPLOAD_DIR, options) {
        this.UPLOAD_DIR = UPLOAD_DIR;
        this.options = options;
    }
    toMp4(videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const compileDir = this.getCompileDir(videoId);
            const dirUpload = this.getUploadDir(videoId);
            const chunksForVideo = yield fs_extra_1.default.promises.readdir(dirUpload);
            const totalChunks = chunksForVideo.length;
            if (totalChunks === 0) {
                throw new Error("No chunks available for this video.");
            }
            const finalFilePath = path_1.default.join(`${compileDir}.mp4`);
            const writeStream = fs_extra_1.default.createWriteStream(finalFilePath);
            yield this.mergeChunks(writeStream, dirUpload, totalChunks);
            return new Promise((resolve, reject) => {
                writeStream.on("finish", () => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.cleanUpChunks(dirUpload, compileDir, totalChunks);
                    }
                    catch (error) {
                        console.error("Error during cleanup:", error);
                    }
                    resolve(finalFilePath);
                }));
                writeStream.on("error", (err) => {
                    console.error("Error while writing file:", err);
                    reject(new Error("Error while writing file"));
                });
            });
        });
    }
    getCompileDir(videoId) {
        var _a;
        const p = path_1.default.join(this.UPLOAD_DIR, ((_a = this.options) === null || _a === void 0 ? void 0 : _a.dirOutput) || "output", videoId);
        fs_extra_1.default.ensureDirSync(p);
        return p;
    }
    getUploadDir(videoId) {
        var _a;
        const p = path_1.default.join(this.UPLOAD_DIR, ((_a = this.options) === null || _a === void 0 ? void 0 : _a.dirUpload) || "chunk", videoId);
        fs_extra_1.default.ensureDirSync(p);
        return p;
    }
    mergeChunks(writeStream, dirUpload, totalChunks) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = path_1.default.join(dirUpload, this.getChunkFileName(i));
                try {
                    const chunkData = yield fs_extra_1.default.promises.readFile(chunkPath);
                    writeStream.write(chunkData);
                }
                catch (error) {
                    console.error(`Error reading chunk ${i}:`, error);
                    throw new Error(`Error reading chunk ${i}`);
                }
            }
            writeStream.end();
        });
    }
    getChunkFileName(index) {
        var _a;
        return ((_a = this.options) === null || _a === void 0 ? void 0 : _a.fileName)
            ? this.options.fileName.replace("$i", index.toString())
            : `index${index}.ts`;
    }
    cleanUpChunks(dirUpload, compileDir, totalChunks) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = path_1.default.join(dirUpload, this.getChunkFileName(i));
                yield fs_extra_1.default.promises.unlink(chunkPath);
            }
            try {
                yield fs_extra_1.default.promises.rmdir(dirUpload); // Hapus folder setelah chunk dihapus
                yield fs_extra_1.default.promises.rmdir(compileDir); // Hapus folder setelah chunk dihapus
            }
            catch (error) {
                setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    yield fs_extra_1.default.promises.rmdir(dirUpload); // Hapus folder setelah chunk dihapus
                    yield fs_extra_1.default.promises.rmdir(compileDir); // Hapus folder setelah chunk dihapus
                    console.log("Deleted ", dirUpload);
                    console.log("Deleted ", compileDir);
                }), 3000);
            }
        });
    }
}
exports.default = VideoCompressor;
