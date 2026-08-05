import { createWordApi } from './wordData';
import { JaArchiveIndexItem, JaWordEntry } from './wordTypes';

const jaApi = createWordApi<JaWordEntry, JaArchiveIndexItem>('data/ja');

export const fetchWordByDate = jaApi.fetchWordByDate;
export const fetchArchiveIndex = jaApi.fetchArchiveIndex;
export const fetchTodayWord = jaApi.fetchTodayWord;
