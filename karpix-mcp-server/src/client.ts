import axios, { type AxiosInstance } from "axios";

export interface KarpixConfig {
    baseUrl: string;
    apiKey: string;
}

export class KarpixClient {
    private axiosInstance: AxiosInstance;

    constructor(config: KarpixConfig) {
        this.axiosInstance = axios.create({
            baseURL: config.baseUrl,
            headers: {
                "X-API-Key": config.apiKey,
                "Content-Type": "application/json",
            },
        });
    }

    async request(path: string, method: "GET" | "POST", data?: any) {
        try {
            const response = await this.axiosInstance({
                url: path,
                method,
                data,
            });
            return response.data;
        } catch (error: any) {
            if (error.response) {
                throw new Error(`Karpix API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
            }
            throw new Error(`Karpix API Connection Error: ${error.message}`);
        }
    }
}
