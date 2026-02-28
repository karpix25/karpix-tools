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
        description: "Verify server health and connectivity. Returns version and status.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "toolkit_authenticate",
        description: "Check if the currently configured API key is valid.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "toolkit_job_status",
        description: "Retrieve complete results and status for a specific job ID.",
        inputSchema: {
            type: "object",
            properties: {
                job_id: { type: "string", description: "The UUID of the job." },
            },
            required: ["job_id"],
        },
    },
    {
        name: "toolkit_jobs_status",
        description: "Query statuses of all recent jobs in a time window.",
        inputSchema: {
            type: "object",
            properties: {
                since_seconds: { type: "integer", default: 600, description: "Seconds to look back." },
            },
        },
    },
    {
        name: "execute_python",
        description: "Runs arbitrary Python code in a remote sandbox and returns stdout/stderr.",
        inputSchema: {
            type: "object",
            properties: {
                code: { type: "string", description: "Python source code." },
                timeout: { type: "integer", minimum: 1, maximum: 600, default: 30 },
            },
            required: ["code"],
        },
    },

    // --- Video Operations ---
    {
        name: "video_trim",
        description: "Extract a portion of a video. Use HH:MM:SS or MM:SS format for start/end.",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
                start: { type: "string", description: "Timestamp to start from." },
                end: { type: "string", description: "Timestamp to end at." },
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
        description: "Remove multiple segments from a video. The 'cuts' array defines parts to KEEP.",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
                cuts: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            start: { type: "string", description: "HH:MM:SS" },
                            end: { type: "string", description: "HH:MM:SS" },
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
        description: "Divide a video into several files at specified time points.",
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
        description: "Stitch multiple video URLs together in order. Must have same dimensions/codecs for best results.",
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
                    minItems: 2,
                },
            },
            required: ["video_urls"],
        },
    },
    {
        name: "video_thumbnail",
        description: "Capture a static image from a video at a specific second.",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
                second: { type: "number", minimum: 0, default: 0, description: "Capture time in seconds." },
            },
            required: ["video_url"],
        },
    },
    {
        name: "video_extract_keyframes",
        description: "Identifies and extracts i-frames (keyframes) from a video.",
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
        description: "Hardcode text subtitles into a video stream. Supports styling.",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
                captions: { type: "string", description: "The transcription or subtitle text content." },
                language: { type: "string", default: "auto" },
                settings: { type: "object", description: "Visual styling (font, color, position)." },
            },
            required: ["video_url", "captions"],
        },
    },
    {
        name: "ffmpeg_compose",
        description: "Advanced FFmpeg composition. CRITICAL: For multiple filters, use SEQUENTIAL chaining with unique labels. Example: '[0:v][1:v]overlay...[t1];[t1][2:v]overlay...[out]'. Each filter must take its primary input from the result of the previous filter. If you define a final label like [out], you MUST provide it in the 'map' property of the output object.",
        inputSchema: {
            type: "object",
            properties: {
                inputs: {
                    type: "array",
                    description: "Input track URLs and processing options.",
                    items: { type: "object" }
                },
                outputs: {
                    type: "array",
                    description: "Requested output streams and codecs.",
                    minItems: 1,
                    items: {
                        type: "object",
                        properties: {
                            map: { type: "string", description: "The label from filtergraph to map to this file (e.g. '[out]')." },
                            options: { type: "array", items: { type: "object" } },
                        },
                        required: ["options"],
                    }
                },
                filters: {
                    type: "array",
                    description: "Filter strings. Sequence matters. Use unique labels for intermediate outputs.",
                    items: { type: "object" }
                },
                global_options: { type: "array", description: "Global FFmpeg flags.", items: { type: "object" } },
            },
            required: ["inputs", "outputs"],
        },
    },

    // --- Audio Operations ---
    {
        name: "audio_concatenate",
        description: "Combines multiple audio source files into a single continuous track.",
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
                    minItems: 2,
                },
            },
            required: ["audio_urls"],
        },
    },
    {
        name: "audio_mixing",
        description: "Overlay an external audio track onto a video. Useful for background music.",
        inputSchema: {
            type: "object",
            properties: {
                video_url: { type: "string", format: "uri" },
                audio_url: { type: "string", format: "uri" },
                video_vol: { type: "number", minimum: 0, maximum: 1, default: 1, description: "Volume level of original video audio (0-1)." },
                audio_vol: { type: "number", minimum: 0, maximum: 1, default: 1, description: "Volume level of overlay audio (0-1)." },
                output_length: { type: "string", enum: ["video", "audio"], default: "video", description: "Whether to trim to video length or audio length." },
            },
            required: ["video_url", "audio_url"],
        },
    },
    {
        name: "audio_media_to_mp3",
        description: "Converts any media (including video) into a high-quality (192kbps+) MP3 audio file.",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri" },
                bitrate: { type: "string", pattern: "^[0-9]+k$", default: "192k" },
                sample_rate: { type: "number", default: 44100 },
            },
            required: ["media_url"],
        },
    },

    // --- Image Operations ---
    {
        name: "image_to_video",
        description: "Turn a single image into a video clip with dynamic zoom/pan motion.",
        inputSchema: {
            type: "object",
            properties: {
                image_url: { type: "string", format: "uri" },
                length: { type: "number", minimum: 1, maximum: 60, default: 5, description: "Duration in seconds." },
                frame_rate: { type: "integer", minimum: 15, maximum: 60, default: 30 },
                zoom_speed: { type: "number", minimum: 0, maximum: 10, default: 3 },
            },
            required: ["image_url"],
        },
    },
    {
        name: "image_screenshot_webpage",
        description: "Render a webpage and capture a screenshot via Playwright. Supports WaitUntil conditions and custom CSS/JS.",
        inputSchema: {
            type: "object",
            properties: {
                url: { type: "string", format: "uri", description: "Target URL." },
                html: { type: "string", description: "HTML content to render directly." },
                viewport_width: { type: "integer", default: 1920 },
                viewport_height: { type: "integer", default: 1080 },
                full_page: { type: "boolean", default: false, description: "Capture beyond the fold." },
                format: { type: "string", enum: ["png", "jpeg"], default: "png" },
                delay: { type: "integer", description: "Wait (ms) after load but before snap.", default: 0 },
                selector: { type: "string", description: "Snap only this specific element." },
                js: { type: "string", description: "JS to run before snapping." },
                css: { type: "string", description: "CSS to inject before snapping." },
                wait_until: { type: "string", enum: ["load", "domcontentloaded", "networkidle", "commit"], default: "networkidle" },
            },
        },
    },

    // --- Media & Transcription ---
    {
        name: "media_metadata",
        description: "Extract technical info (codecs, FPS, resolution) from a remote URL. Extremely fast.",
        inputSchema: {
            type: "object",
            properties: { media_url: { type: "string", format: "uri" } },
            required: ["media_url"],
        },
    },
    {
        name: "media_transcribe",
        description: "State-of-the-art speech-to-text. Task 'translate' converts non-English audio TO English text.",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri" },
                task: { type: "string", enum: ["transcribe", "translate"], default: "transcribe" },
                include_text: { type: "boolean", default: true, description: "Return plain text." },
                include_srt: { type: "boolean", default: false, description: "Return SRT content." },
                include_segments: { type: "boolean", default: false, description: "Return detailed timestamps." },
                response_type: { type: "string", enum: ["direct", "cloud"], default: "direct" },
                language: { type: "string", description: "Source ISO code (e.g. 'ru', 'fr')." },
                max_words_per_line: { type: "integer", description: "Split segments at N words." },
            },
            required: ["media_url"],
        },
    },
    {
        name: "media_generate_ass",
        description: "Generate highly styled Advanced Substation Alpha subtitles.",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri" },
                canvas_width: { type: "integer", default: 1920 },
                canvas_height: { type: "integer", default: 1080 },
                settings: { type: "object", description: "Gradients, animations, font overrides." },
                language: { type: "string" },
            },
            required: ["media_url"],
        },
    },
    {
        name: "media_convert",
        description: "Universal format transcode. Supports any extension (e.g. mp4 -> mov, wav -> mp3).",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri" },
                format: { type: "string", description: "Target extension (e.g. 'mp4')." },
                video_codec: { type: "string", default: "libx264" },
                audio_codec: { type: "string", default: "aac" },
            },
            required: ["media_url", "format"],
        },
    },
    {
        name: "media_download",
        description: "Automated scraping of video/audio from almost any social platform via yt-dlp.",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri", description: "Social media post URL." },
                cloud_upload: { type: "boolean", default: true, description: "Save to result storage." },
                subtitles: { type: "object", description: "Download auto-captions if available." },
            },
            required: ["media_url"],
        },
    },
    {
        name: "media_silence",
        description: "Find quiet parts of a media file. Useful for cutting pauses.",
        inputSchema: {
            type: "object",
            properties: {
                media_url: { type: "string", format: "uri" },
                duration: { type: "number", minimum: 0.1, default: 0.5, description: "Threshold duration." },
                noise: { type: "string", default: "-30dB", description: "Silence volume threshold." },
            },
            required: ["media_url", "duration"],
        },
    },

    // --- Cloud Storage ---
    {
        name: "storage_upload_gcs",
        description: "Mirror a remote URL directly to a Google Cloud Storage bucket.",
        inputSchema: {
            type: "object",
            properties: {
                file_url: { type: "string", format: "uri", description: "Source URL." },
                filename: { type: "string", description: "Path/name in bucket." },
                public: { type: "boolean", default: false, description: "Grant public read access." },
            },
            required: ["file_url", "filename"],
        },
    },
    {
        name: "storage_upload_s3",
        description: "Mirror a remote URL directly to an S3-compatible bucket (AWS, Digital Ocean, Beget).",
        inputSchema: {
            type: "object",
            properties: {
                file_url: { type: "string", format: "uri", description: "Source URL." },
                filename: { type: "string", description: "Path/name in bucket." },
                public: { type: "boolean", default: false, description: "Grant public read access." },
            },
            required: ["file_url", "filename"],
        },
    },
    {
        name: "storage_upload_gdrive",
        description: "Mirror a remote URL directly to a specific Google Drive folder.",
        inputSchema: {
            type: "object",
            properties: {
                file_url: { type: "string", format: "uri", description: "Source URL." },
                filename: { type: "string", description: "Saved filename." },
                folder_id: { type: "string", description: "Drive Folder UUID." },
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
