import { IPluginInfo } from "../types";
export declare const GATSBY_CLOUD_PLUGIN_NAME = "gatsby-plugin-gatsby-cloud";
export declare function addGatsbyPluginCloudPluginWhenInstalled(plugins: Array<IPluginInfo>, rootDir: string): void;
export declare function incompatibleGatsbyCloudPlugin(plugins: Array<IPluginInfo>): boolean;
