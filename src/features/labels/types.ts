import { Article } from '../../../types';

export type DownloadFormat = 'pdf' | 'png';
export type LabelViewMode = 'articles' | 'locations';
export type LocationOccupancyFilter = 'all' | 'single' | 'multi';

export interface LabelConfig {
    width: number; // mm
    height: number; // mm
    fontSizeScale: number; // 1 = default
}

export interface GroupedLocation {
    uniqueKey: string; // Composite key for selection
    category: string;
    locationName: string;
    articles: Article[];
}

export const DEFAULT_LABEL_CONFIG: LabelConfig = { width: 70, height: 37, fontSizeScale: 1 };
