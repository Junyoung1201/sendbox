declare module 'streamsaver' {
    interface StreamSaver {
        createWriteStream(filename: string, options?: {
            size?: number;
            pathname?: string;
            writableStrategy?: QueuingStrategy;
            readableStrategy?: QueuingStrategy;
        }): WritableStream;
        WritableStream: typeof WritableStream;
        supported: boolean;
        version: {
            full: string;
            major: number;
            minor: number;
            dot: number;
        };
        mitm: string;
    }

    const streamSaver: StreamSaver;
    export default streamSaver;
}
