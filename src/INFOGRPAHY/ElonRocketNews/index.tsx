export { ElonRocketNews, getPersonNewsDuration } from './Main';
export type { PersonNewsConfig } from './Main';
import rocketNewsConfig from './rocket-news.config.json';
import { getPersonNewsDuration } from './Main';

export const ELON_FPS = 30;
export const ELON_TOTAL_FRAMES = getPersonNewsDuration(rocketNewsConfig as any, ELON_FPS);
