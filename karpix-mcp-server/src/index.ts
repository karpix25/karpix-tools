import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { KarpixClient } from "./client.js";
import express from "express";

const API_KEY = process.env.KARPIX_API_KEY;
const BASE_URL = process.env.KARPIX_BASE_URL || "http://localhost:8080";
const TRANSPORT = process.env.MCP_TRANSPORT || "stdio"; // "stdio" or "sse"
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
    console.error("KARPIX_API_KEY environment variable is required");
    process.exit(1);
}

const client = new KarpixClient({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
});

const server = new Server(
    {
        name: "karpix-tools",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

/**
 * Define tool schemas
 */
const TOOLS = [
    // --- Toolkit & Auth ---
    {
        name: "toolkit_test",
        description: "Test API connectivity and setup",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "toolkit_authenticate",
        description: "Verify API key validity",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "toolkit_job_status",
        description: "Check the status and results of a specific job",
        inputSchema: {
            type: "object",
            properties: {
                job_id: { type: "string", description: "Unique job ID to check" },
            },
            required: ["job_id"],
        },
    },
    {
        name: "toolkit_jobs_status",
        description: "Get the status of all jobs within a specified time range",
        inputSchema: {
            type: "object",
            properties: {
                since_seconds: { type: "integer", default: 600, description: "Time range in seconds" },
            },
        },
    },
    {
        name: "execute_python",
        description: "Execute Python code in a controlled environment",
        inputSchema: {
            type: "object",
            properties: {
                code: { type: "string", description: "Python code to execute" },
                timeout: { type: "integer", minimum: 1, maximum: 300, default: 30 },
            },
            required: ["code"],
        },
    },

    // --- Video Operations ---
    {
        name: "video_trim",
        description: "Trim a video by removing specified portions from the beginning and/or end",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
                start: { type: "string", description: "Start time (HH:MM:SS)" },
                end: { type: "string", description: "End time (HH:MM:SS)" },
                video_codec: { type: "string", default: "libx264" },
                video_preset: { type: "string", default: "medium" },
                video_crf: { type: "number", minimum: 0, maximum: 51, default: 23 },
                audio_codec: { type: "string", default: "aac" },
                audio_bitrate: { type: "string", default: "128k" },
            },
            required: ["video_url"],
        },
    },
    {
        name: "video_cut",
        description: "Cut specified segments from a video file",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
                cuts: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            start: { type: "string" },
                            end: { type: "string" },
                        },
                        required: ["start", "end"],
                    },
                },
                video_codec: { type: "string", default: "libx264" },
                video_crf: { type: "number", default: 23 },
            },
            required: ["video_url", "cuts"],
        },
    },
    {
        name: "video_split",
        description: "Split a video file into multiple segments",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
                splits: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            start: { type: "string" },
                            end: { type: "string" },
                        },
                        required: ["start", "end"],
                    },
                },
            },
            required: ["video_url", "splits"],
        },
    },
    {
        name: "video_concatenate",
        description: "Combine multiple videos into one",
        inputSchema: {
            type: "object",
            properties: {
                video_urls: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: { video_url: { type: "string", format: "uri" } },
                        required: ["video_url"],
                    },
                    minItems: 1,
                },
            },
            required: ["video_urls"],
        },
    },
    {
        name: "video_thumbnail",
        description: "Extract a thumbnail from a video at a specific time",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
                second: { type: "number", minimum: 0, default: 0 },
            },
            required: ["video_url"],
        },
    },
    {
        name: "video_extract_keyframes",
        description: "Extract keyframes from a video file",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
            },
            required: ["video_url"],
        },
    },
    {
        name: "video_caption",
        description: "Burn captions (ASS/SRT) into a video",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
                captions: { type: "string", description: "Subtitle content" },
                language: { type: "string", default: "auto" },
                settings: { type: "object" },
            },
            required: ["video_url"],
        },
    },
    {
        name: "ffmpeg_compose",
        description: "Advanced FFmpeg composition with multiple inputs and filters",
        inputSchema: {
            type: "object",
            properties: {
                inputs: { type: "array", items: { type: "object" } },
                outputs: { type: "array", items: { type: "object" } },
                filters: { type: "array", items: { type: "object" } },
                global_options: { type: "array", items: { type: "object" } },
            },
            required: ["inputs", "outputs"],
        },
    },

    // --- Audio Operations ---
    {
        name: "audio_concatenate",
        description: "Combine multiple audio files into one",
        inputSchema: {
            type: "object",
            properties: {
                audio_urls: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: { audio_url: { type: "string", format: "uri" } },
                        required: ["audio_url"],
                    },
                    minItems: 1,
                },
            },
            required: ["audio_urls"],
        },
    },
    {
        name: "audio_mixing",
        description: "Mix a video's audio with an external audio file",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
                audio_url: { type: "string", format: "uri" },
                video_vol: { type: "number", minimum: 0, maximum: 100, default: 100 },
                audio_vol: { type: "number", minimum: 0, maximum: 100, default: 100 },
                output_length: { type: "string", enum: ["video", "audio"], default: "video" },
            },
            required: ["video_url", "audio_url"],
        },
    },
    {
        name: "audio_media_to_mp3",
        description: "Convert any media file to MP3 format",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri" },
                bitrate: { type: "string", pattern: "^[0-9]+k$", default: "128k" },
                sample_rate: { type: "number" },
            },
            required: ["media_url"],
        },
    },

    // --- Image Operations ---
    {
        name: "image_to_video",
        description: "Create a video with a zoom/pan effect from a static image",
        inputSchema: {
            type: "object",
            properties: {
                image_url: { type: "string", format: "uri" },
                length: { type: "number", minimum: 0.1, maximum: 400, default: 5 },
                frame_rate: { type: "integer", minimum: 15, maximum: 60, default: 30 },
                zoom_speed: { type: "number", minimum: 0, maximum: 100, default: 3 },
            },
            required: ["image_url"],
        },
    },
    {
        name: "image_screenshot_webpage",
        description: "Take a screenshot of a webpage using Playwright",
        inputSchema: {
            type: "object",
            properties: {
                url: { type: "string", format: "uri" },
                html: { type: "string" },
                viewport_width: { type: "integer", default: 1280 },
                viewport_height: { type: "integer", default: 720 },
                full_page: { type: "boolean", default: false },
                format: { type: "string", enum: ["png", "jpeg"], default: "png" },
            },
        },
    },

    // --- Media & Transcription ---
    {
        name: "media_metadata",
        description: "Extract metadata from a media file",
        inputSchema: {
            type: "object",
            properties: { media_url: { type: "string", format: "uri" } },
            required: ["media_url"],
        },
    },
    {
        name: "media_transcribe",
        description: "Transcribe media (video or audio) using advanced options",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri" },
                task: { type: "string", enum: ["transcribe", "translate"], default: "transcribe" },
                include_text: { type: "boolean", default: true },
                include_srt: { type: "boolean", default: false },
                include_segments: { type: "boolean", default: false },
                response_type: { type: "string", enum: ["direct", "cloud"], default: "direct" },
                language: { type: "string" },
            },
            required: ["media_url"],
        },
    },
    {
        name: "media_generate_ass",
        description: "Generate ASS subtitle files with advanced styling",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri" },
                canvas_width: { type: "integer" },
                canvas_height: { type: "integer" },
                settings: { type: "object" },
                language: { type: "string" },
            },
            required: ["media_url"],
        },
    },
    {
        name: "media_convert",
        description: "Convert media to a different format with encoding control",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri" },
                format: { type: "string", description: "Target extension (e.g., 'mp4', 'mkv')" },
                video_codec: { type: "string" },
                audio_codec: { type: "string" },
            },
            required: ["media_url", "format"],
        },
    },
    {
        name: "media_download",
        description: "Download media from various sources using yt-dlp (BETA)",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri" },
                cloud_upload: { type: "boolean", default: true },
                subtitles: { type: "object" },
            },
            required: ["media_url"],
        },
    },
    {
        name: "media_silence",
        description: "Detect silence intervals in a media file",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri" },
                duration: { type: "number", minimum: 0.1, description: "Minimum silence duration" },
                noise: { type: "string", default: "-30dB" },
            },
            required: ["media_url", "duration"],
        },
    },

    // --- Cloud Storage ---
    {
        name: "storage_upload_gcp",
        description: "Stream a file from a URL to Google Cloud Storage",
        inputSchema: {
            type: "object",
            properties: {
                file_url: { type: "string", format: "uri" },
                filename: { type: "string" },
                public: { type: "boolean", default: false },
            },
            required: ["file_url"],
        },
    },
    {
        name: "storage_upload_s3",
        description: "Stream a file from a URL to Amazon S3 or compatible storage",
        inputSchema: {
            type: "object",
            properties: {
                file_url: { type: "string", format: "uri" },
                filename: { type: "string" },
                public: { type: "boolean", default: false },
            },
            required: ["file_url"],
        },
    },
    {
        name: "storage_upload_gdrive",
        description: "Upload a file from a URL to Google Drive",
        inputSchema: {
            type: "object",
            properties: {
                file_url: { type: "string", format: "uri" },
                filename: { type: "string" },
                folder_id: { type: "string" },
            },
            required: ["file_url", "filename", "folder_id"],
        },
    },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            // Toolkit
            case "toolkit_test":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/toolkit/test", "GET")) }] };
            case "toolkit_authenticate":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/toolkit/authenticate", "GET")) }] };
            case "toolkit_job_status":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/toolkit/job/status", "POST", args)) }] };
            case "toolkit_jobs_status":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/toolkit/jobs/status", "POST", args)) }] };
            case "execute_python":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/code/execute/python", "POST", args)) }] };

            // Video
            case "video_trim":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/video/trim", "POST", args)) }] };
            case "video_cut":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/video/cut", "POST", args)) }] };
            case "video_split":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/video/split", "POST", args)) }] };
            case "video_concatenate":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/video/concatenate", "POST", args)) }] };
            case "video_thumbnail":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/video/thumbnail", "POST", args)) }] };
            case "video_extract_keyframes":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/extract-keyframes", "POST", args)) }] };
            case "video_caption":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/video/caption", "POST", args)) }] };
            case "ffmpeg_compose":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/ffmpeg/compose", "POST", args)) }] };

            // Audio
            case "audio_concatenate":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/audio/concatenate", "POST", args)) }] };
            case "audio_mixing":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/audio-mixing", "POST", args)) }] };
            case "audio_media_to_mp3":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/media/convert/mp3", "POST", args)) }] };

            // Image
            case "image_to_video":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/image/convert/video", "POST", args)) }] };
            case "image_screenshot_webpage":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/image/screenshot/webpage", "POST", args)) }] };

            // Media
            case "media_metadata":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/media/metadata", "POST", args)) }] };
            case "media_transcribe":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/media/transcribe", "POST", args)) }] };
            case "media_generate_ass":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/media/generate/ass", "POST", args)) }] };
            case "media_convert":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/media/convert", "POST", args)) }] };
            case "media_download":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/BETA/media/download", "POST", args)) }] };
            case "media_silence":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/media/silence", "POST", args)) }] };

            // Storage
            case "storage_upload_gcp":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/gcp/upload", "POST", args)) }] };
            case "storage_upload_s3":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/v1/s3/upload", "POST", args)) }] };
            case "storage_upload_gdrive":
                return { content: [{ type: "text", text: JSON.stringify(await client.request("/gdrive-upload", "POST", args)) }] };

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
});

async function main() {
    if (TRANSPORT === "sse") {
        const app = express();
        let transport: SSEServerTransport | null = null;

        app.get("/sse", async (req, res) => {
            console.log("New SSE connection");
            transport = new SSEServerTransport("/messages", res);
            await server.connect(transport);
        });

        app.post("/messages", async (req, res) => {
            if (transport) {
                await transport.handlePostMessage(req, res);
            } else {
                res.status(400).send("No active SSE session");
            }
        });

        app.listen(PORT, () => {
            console.error(`Karpix Tools MCP Server running on SSE at http://localhost:${PORT}/sse`);
        });
    } else {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("Karpix Tools MCP Server running on stdio");
    }
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
