import city from './data/city-of-stars.json';
import cant from './data/cant-take-my-eyes-off-you.json';
import glimpse from './data/glimpse-of-us.json';
import type { Song } from './types';
import { validateSong } from './validate';

export { validateSong } from './validate';
export type { Song, SongStep } from './types';

export const SONGS: Song[] = [city, cant, glimpse].map(validateSong);
