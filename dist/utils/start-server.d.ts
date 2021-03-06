/// <reference types="node" />
import webpack from "webpack";
import http from "http";
import * as WorkerPool from "../utils/worker/pool";
import { WebsocketManager } from "../utils/websocket-manager";
import { IProgram } from "../commands/types";
import type { Express } from "express";
declare type ActivityTracker = any;
interface IServer {
    compiler: webpack.Compiler;
    listener: http.Server;
    webpackActivity: ActivityTracker;
    websocketManager: WebsocketManager;
    workerPool: WorkerPool.GatsbyWorkerPool;
    webpackWatching: IWebpackWatchingPauseResume;
}
export interface IWebpackWatchingPauseResume {
    suspend: () => void;
    resume: () => void;
}
export declare function startServer(program: IProgram, app: Express, workerPool?: WorkerPool.GatsbyWorkerPool): Promise<IServer>;
export {};
