// Type definitions for the CLI engine

export interface PassiveSkillData {
    skill: number;
    name: string;
    stats: string[];
    isNotable?: boolean;
    isKeystone?: boolean;
    isJewelSocket?: boolean;
    isMastery?: boolean;
    isBlight?: boolean;
    isProxy?: boolean;
    ascendancyName?: string;
    orbit: number | null;
    orbitIndex?: number;
    group?: number;
    out?: string[];
    in?: string[];
    x?: number;
    y?: number;
    icon?: string;
}

export interface AlternatePassiveSkill {
    _rid: number;
    Id: string;
    AlternateTreeVersionsKey: number;
    Name: string;
    PassiveType: number[];
    StatsKeys: number[];
    Stat1Min: number;
    Stat1Max: number;
    Stat2Min: number;
    Stat2Max: number;
    Unknown10: number;
    Unknown11: number;
    Unknown12: number;
    Unknown13: number;
    SpawnWeight: number;
    RandomMin: number;
    RandomMax: number;
}

export interface AlternatePassiveAddition {
    _rid: number;
    Id: string;
    AlternateTreeVersionsKey: number;
    SpawnWeight: number;
    StatsKeys: number[];
    Stat1Min: number;
    Stat1Max: number;
    Stat2Min: number;
    Stat2Max: number;
    PassiveType: number[];
}

export enum PassiveSkillType {
    None = 0,
    SmallAttribute = 1,
    SmallNormal = 2,
    Notable = 3,
    KeyStone = 4,
    JewelSocket = 5
}

export interface JewelType {
    label: string;
    name: string;
    id: number;
    min: number;
    max: number;
}

export const JEWEL_TYPES: JewelType[] = [
    { label: "Glorious Vanity", name: "vaal", id: 1, min: 100, max: 8000 },
    { label: "Lethal Pride", name: "karui", id: 2, min: 10000, max: 18000 },
    { label: "Brutal Restraint", name: "maraketh", id: 3, min: 500, max: 8000 },
    { label: "Militant Faith", name: "templar", id: 4, min: 2000, max: 10000 },
    { label: "Elegant Hubris", name: "eternal", id: 5, min: 2000, max: 160000 },
    { label: "Heroic Tragedy", name: "kalguur", id: 6, min: 100, max: 8000 },
];

export interface TranslationEntry {
    from?: number;
    to?: number;
    divider?: number;
    translation: string;
}

export interface SocketResult {
    socketId: string;
    socketName: string;
    socketAlias: string;
    socketCoords: { x: number; y: number };
    matches: MatchedNode[];
    totalMatchCount: number;
}

export interface MatchedNode {
    nodeId: number;
    nodeName: string;
    nodeType: string;
    statKey: number;
    statValue: number;
    statLabel: string;
    source: 'replacement' | 'addition';
    alternateSkillId?: string;
}
