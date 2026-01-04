export class NewsKeywordDto {
    keyword: string;
    entityType: 'GEO_UNIT' | 'CANDIDATE' | 'PARTY';
    entityId: number;
}

export class GenerateKeywordsDto {
    entityType: 'GEO_UNIT' | 'CANDIDATE' | 'PARTY';
    entityId: number;
}
