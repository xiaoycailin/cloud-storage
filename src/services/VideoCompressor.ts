import path from "path";
import fs from "fs-extra";
import { URL_HSL_PATH } from "../queue2";

export default class VideoCompressor {
    constructor(
        private UPLOAD_DIR: string,
        private options?: {
            dirUpload?: string;
            dirOutput?: string;
            /**
             * @param filename default index{$index: number}.ts
             */
            fileName?: string;
        }
    ) { }

    async toMp4(videoId: string): Promise<URL_HSL_PATH> {
        const compileDir = this.getCompileDir(videoId);
        const dirUpload = this.getUploadDir(videoId);

        const chunksForVideo = await fs.promises.readdir(dirUpload);
        const totalChunks = chunksForVideo.length;

        if (totalChunks === 0) {
            throw new Error("No chunks available for this video.");
        }

        const finalFilePath = path.join(`${compileDir}.mp4`);
        const writeStream = fs.createWriteStream(finalFilePath);

        await this.mergeChunks(writeStream, dirUpload, totalChunks);

        return new Promise((resolve, reject) => {
            writeStream.on("finish", async () => {
                try {
                    await this.cleanUpChunks(dirUpload, compileDir, totalChunks);
                } catch (error) {
                    console.error("Error during cleanup:", error);
                }
                resolve(finalFilePath as any);
            });

            writeStream.on("error", (err) => {
                console.error("Error while writing file:", err);
                reject(new Error("Error while writing file"));
            });
        });
    }

    private getCompileDir(videoId: string): string {
        const p = path.join(
            this.UPLOAD_DIR,
            this.options?.dirOutput || "output",
            videoId
        );
        fs.ensureDirSync(p);
        return p;
    }

    private getUploadDir(videoId: string): string {
        const p = path.join(
            this.UPLOAD_DIR,
            this.options?.dirUpload || "chunk",
            videoId
        );
        fs.ensureDirSync(p);
        return p;
    }

    private async mergeChunks(
        writeStream: fs.WriteStream,
        dirUpload: string,
        totalChunks: number
    ) {
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(dirUpload, this.getChunkFileName(i));
            try {
                const chunkData = await fs.promises.readFile(chunkPath);
                writeStream.write(chunkData);
            } catch (error) {
                console.error(`Error reading chunk ${i}:`, error);
                throw new Error(`Error reading chunk ${i}`);
            }
        }
        writeStream.end();
    }

    private getChunkFileName(index: number): string {
        return this.options?.fileName
            ? this.options.fileName.replace("$i", index.toString())
            : `index${index}.ts`;
    }

    private async cleanUpChunks(
        dirUpload: string,
        compileDir: string,
        totalChunks: number
    ) {
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(dirUpload, this.getChunkFileName(i));
            await fs.promises.unlink(chunkPath);
        }
        try {
            await fs.promises.rmdir(dirUpload); // Hapus folder setelah chunk dihapus
            await fs.promises.rmdir(compileDir); // Hapus folder setelah chunk dihapus
        } catch (error) {
            setTimeout(async () => {
                await fs.promises.rmdir(dirUpload); // Hapus folder setelah chunk dihapus
                await fs.promises.rmdir(compileDir); // Hapus folder setelah chunk dihapus

                console.log("Deleted ", dirUpload);
                console.log("Deleted ", compileDir);
            }, 3000);
        }
    }
}
