import { Request } from "express";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

export interface Resolution {
  width: number;
  height: number;
}
export type URL_HSL__PATH = `/hls/${string}/${string}p/index.m3u8`;
export default class Upload {
  private outputDir: string;
  private static availableResolutions = [240, 360, 480, 720, 1080, 1440, 2160];
  private static resolutions: Resolution[] = [
    { height: 240, width: 426 },
    { height: 360, width: 640 },
    { height: 480, width: 854 },
    { height: 720, width: 1280 },
    { height: 1080, width: 1920 },
    { height: 1440, width: 2560 }, // 1440p (Quad HD)
    { height: 2160, width: 3840 }, // 2160p (4K UHD)
  ];

  constructor(private req: Request, options: { outputDir: string }) {
    this.outputDir = options.outputDir;

    // Buat direktori output untuk menyimpan file HLS
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // Mendapatkan informasi video (termasuk resolusi asli)
  private getVideoInfo(
    inputFilePath: string
  ): Promise<Resolution & { aspectRatio: string }> {
    return new Promise((resolve, reject) => {
      const ffprobeCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${inputFilePath}`;
      exec(ffprobeCommand, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`Failed to get video info: ${stderr}`));
        }
        const [width, height] = stdout.trim().split(",").map(Number);
        const aspectRatio = (width / height).toFixed(2); // Mendapatkan aspect ratio dalam dua desimal
        resolve({ width, height, aspectRatio });
      });
    });
  }

  private filterSupportedResolutions(originalHeight: number): number[] {
    return Upload.availableResolutions.filter((res) => res <= originalHeight);
  }

  private getCommand(
    resolution: number,
    inputFilePath: string,
    aspectRatio: string
  ): string {
    const resolutionConfig = Upload.resolutions.find(
      (r) => r.height === resolution
    );
    if (!resolutionConfig) {
      throw new Error(`Unsupported resolution: ${resolution}`);
    }

    const outputFilePath = path.join(
      this.outputDir,
      `${resolution}p/index.m3u8`
    );

    // Buat direktori untuk resolusi jika belum ada
    if (!fs.existsSync(path.dirname(outputFilePath))) {
      fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
    }

    let scaleFilter;

    // Cek apakah aspect ratio mendekati 9:16
    if (Math.abs(parseFloat(aspectRatio) - 9 / 16) < 0.01) {
      // Jika aspect ratio 9:16, sesuaikan lebar secara otomatis
      scaleFilter = `scale=-1:${resolutionConfig.height}`;
    } else {
      // Jika aspect ratio bukan 9:16, sesuaikan tinggi dengan resolusi yang ditentukan
      scaleFilter = `scale=${resolutionConfig.width}:${resolutionConfig.height}`;
    }

    const ffmpegCommand = `ffmpeg -i ${inputFilePath} -vf "${scaleFilter}" -c:v libx264 -preset veryfast -crf 23 -c:a aac -strict -2 -b:a 128k -start_number 0 -hls_time 10 -hls_list_size 0 -f hls ${outputFilePath}`;

    return ffmpegCommand;
  }

  public async queue() {
    const inputFilePath = this.req.file?.path;
    if (!inputFilePath) {
      throw new Error("No video file uploaded.");
    }

    const { height: originalHeight, aspectRatio } = await this.getVideoInfo(
      inputFilePath
    );
    let supportedResolutions = this.filterSupportedResolutions(originalHeight);

    // Jika aspect ratio 9:16, filter resolusi berdasarkan resolusi vertikal
    if (aspectRatio === (9 / 16).toFixed(2)) {
      console.log("Aspect ratio is 9:16, using vertical resolutions only.");
      supportedResolutions = supportedResolutions.filter((res) => res <= 720); // Misalnya hanya sampai 720p
    }

    try {
      const uploads = await Promise.all(
        supportedResolutions.map(async (resolution) => {
          const upload = await this.now(resolution);
          console.log("Uploaded Resolution: " + resolution, upload);
          return upload;
        })
      );

      // Tunggu beberapa detik sebelum menghapus file asli
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Tunggu 2 detik

      // Hapus file asli setelah semua upload selesai
      if (fs.existsSync(inputFilePath)) {
        await fs.promises.unlink(inputFilePath);
        console.log("Original file deleted successfully.");
      } else {
        console.log("Original file does not exist, skipping deletion.");
      }

      return uploads; // Kembalikan hasil upload
    } catch (error) {
      console.error("Error during upload:", error);
      // Coba menghapus lagi jika terjadi kesalahan
      try {
        // Memeriksa keberadaan file sebelum menghapus
        if (fs.existsSync(inputFilePath)) {
          await fs.promises.unlink(inputFilePath);
          console.log("Original file deleted successfully (after error).");
        } else {
          console.log(
            "Original file does not exist, skipping deletion (after error)."
          );
        }
      } catch (unlinkError) {
        console.error("Error deleting file after upload error:", unlinkError);
      }
      throw error; // Lemparkan kembali error jika terjadi kesalahan
    }
  }

  public uploadNow(resolution: number = 240) {
    return this.now(resolution);
  }

  private async now(
    resolution: number = 240
  ): Promise<{ url: URL_HSL__PATH; filename?: string }> {
    const inputFilePath = this.req.file?.path;
    if (!inputFilePath) {
      throw new Error("No video file uploaded.");
    }

    const info = await this.getVideoInfo(inputFilePath);
    return new Promise((resolve, reject) => {
      const ffmpegCommand = this.getCommand(
        resolution,
        inputFilePath,
        info.aspectRatio
      );
      exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error during FFmpeg execution: ${error.message}`);
          return reject(new Error("Failed to convert video."));
        }
        resolve({
          url: `/hls/${this.req.file?.filename}/${resolution}p/index.m3u8`,
          filename: this.req.file?.filename,
        });
      });
    });
  }

  static async uploadFromFile(
    inputFilePath: string,
    outputDir: string
  ): Promise<{ url: URL_HSL__PATH; filename: string }> {
    const getVideoInfo = (filePath: string): Promise<Resolution> => {
      return new Promise((resolve, reject) => {
        const ffprobeCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ${filePath}`;
        exec(ffprobeCommand, (error, stdout, stderr) => {
          if (error) {
            return reject(new Error(`Failed to get video info: ${stderr}`));
          }
          const [width, height] = stdout.trim().split(",").map(Number);
          resolve({ width, height });
        });
      });
    };

    const filterSupportedResolutions = (originalHeight: number): number[] => {
      const availableResolutions = [240, 360, 480, 720, 1080, 1440, 2160];
      return availableResolutions.filter((res) => res <= originalHeight);
    };

    const getCommand = (resolution: number, filePath: string): string => {
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

      const outputFilePath = path.join(outputDir, `${resolution}p/index.m3u8`);
      if (!fs.existsSync(path.dirname(outputFilePath))) {
        fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
      }

      return `ffmpeg -i ${filePath} -vf scale=w=${resolutionConfig.width}:h=${resolutionConfig.height} -c:v libx264 -preset veryfast -crf 23 -c:a aac -strict -2 -b:a 128k -start_number 0 -hls_time 10 -hls_list_size 0 -f hls ${outputFilePath}`;
    };

    const { height: originalHeight } = await getVideoInfo(inputFilePath);
    try {
      const supportedResolutions = filterSupportedResolutions(originalHeight);

      const uploads = await Promise.all(
        supportedResolutions.map(async (resolution) => {
          const ffmpegCommand = getCommand(resolution, inputFilePath);
          return new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error) => {
              if (error) {
                return reject(
                  new Error(`Failed to convert video to ${resolution}p`)
                );
              }
              resolve({
                url: `/hls/${path.basename(
                  inputFilePath
                )}/${resolution}p/index.m3u8`,
                filename: path.basename(inputFilePath),
              });
            });
          });
        })
      );

      // Hapus file asli setelah konversi selesai
      await fs.promises.unlink(inputFilePath);
      return uploads as any;
    } catch (error: any) {
      await fs.promises.unlink(inputFilePath);
      throw new Error(`Error during video conversion: ${error.message}`);
    }
  }
}
