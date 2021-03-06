import { ActionsUnion, IGatsbyNode } from "../../../redux/types";
import type { Database } from "lmdb";
declare type NodeId = string;
export declare function updateNodes(nodesDb: Database<IGatsbyNode, NodeId>, action: ActionsUnion): Promise<boolean> | boolean;
export {};
