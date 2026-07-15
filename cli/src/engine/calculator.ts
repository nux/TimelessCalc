import { RandomNumberGenerator } from './random.js';
import { TimelessJewel } from './jewel.js';
import { AlternateTreeVersion } from './tree-version.js';
import type {
    PassiveSkillData,
    AlternatePassiveSkill,
    AlternatePassiveAddition,
    MatchedNode,
    SocketResult,
    TranslationEntry,
} from './types.js';
import { PassiveSkillType } from './types.js';

// --- Data loading ---

let passiveSkills: Map<number, PassiveSkillData> | null = null;
let alternatePassiveSkills: AlternatePassiveSkill[] | null = null;
let alternatePassiveAdditions: AlternatePassiveAddition[] | null = null;
let translations: Map<number, TranslationEntry[]> | null = null;
let socketNodes: Record<string, string[]> | null = null;
let nodeCoords: Map<number, { x: number; y: number }> | null = null;
let socketAliases: Map<string, string> | null = null;

import fs from 'fs';
import path from 'path';

export function initialize(dataDir: string): void {
    if (passiveSkills) return;

    // Load passive skills from data.json (same as tree.json structure)
    const dataPath = path.join(dataDir, 'data.json');
    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const { nodes, ...rest } = rawData;

    passiveSkills = new Map();
    for (const [key, node] of Object.entries(nodes) as [string, PassiveSkillData][]) {
        const skill = node as PassiveSkillData;
        skill.isNotable = skill.isNotable || false;
        skill.isKeystone = skill.isKeystone || false;
        skill.isJewelSocket = skill.isJewelSocket || false;
        skill.stats = skill.stats || [];
        passiveSkills.set(skill.skill, skill);
    }

    // Load tree.json for socketNodes and coordinates
    const treePath = path.join(dataDir, 'tree.json');
    const treeData = JSON.parse(fs.readFileSync(treePath, 'utf-8'));
    socketNodes = treeData.socketNodes;

    // Build coordinate map
    nodeCoords = new Map();
    for (const [key, node] of Object.entries(treeData.nodes) as [string, PassiveSkillData][]) {
        if (node.x !== undefined && node.y !== undefined) {
            nodeCoords.set(Number(key), { x: node.x, y: node.y });
        }
    }

    // Load alternate passive skills
    const apsPath = path.join(dataDir, 'alternatepassiveskills.json');
    alternatePassiveSkills = JSON.parse(fs.readFileSync(apsPath, 'utf-8'));

    // Load alternate passive additions
    const apaPath = path.join(dataDir, 'alternatepassiveadditions.json');
    alternatePassiveAdditions = JSON.parse(fs.readFileSync(apaPath, 'utf-8'));

    // Load translations
    const transPath = path.join(dataDir, 'translation.json');
    const transData = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    translations = new Map();
    for (const [key, entries] of Object.entries(transData) as [string, TranslationEntry[]][]) {
        translations.set(Number(key), entries);
    }

    // Build socket -> keystone alias map (nearest keystone per socket)
    socketAliases = new Map();
    const keystones = new Map<number, { name: string; x: number; y: number }>();
    for (const [key, node] of Object.entries(rawData.nodes) as [string, PassiveSkillData][]) {
        if (node.isKeystone) {
            const coords = nodeCoords.get(Number(key));
            if (coords) {
                keystones.set(Number(key), { name: node.name, ...coords });
            }
        }
    }

    if (socketNodes) {
        for (const socketId of Object.keys(socketNodes)) {
            const coords = nodeCoords.get(Number(socketId));
            if (!coords) continue;

            let bestKeystone: string | null = null;
            let bestDist = Infinity;
            for (const ks of keystones.values()) {
                const d = Math.sqrt((coords.x - ks.x) ** 2 + (coords.y - ks.y) ** 2);
                if (d < bestDist) {
                    bestDist = d;
                    bestKeystone = ks.name;
                }
            }
            if (bestKeystone) {
                socketAliases.set(socketId, bestKeystone);
            }
        }
    }
}

// --- Helper functions ---

function getPassiveSkillType(skill: PassiveSkillData): PassiveSkillType {
    if (skill.isJewelSocket) return PassiveSkillType.JewelSocket;
    if (skill.isKeystone) return PassiveSkillType.KeyStone;
    if (skill.isNotable) return PassiveSkillType.Notable;
    if (isAttribute(skill)) return PassiveSkillType.SmallAttribute;
    return PassiveSkillType.SmallNormal;
}

function isAttribute(skill: PassiveSkillData): boolean {
    return (
        skill.stats.length === 1 &&
        ['+10 to Strength', '+10 to Dexterity', '+10 to Intelligence'].includes(skill.stats[0])
    );
}

function isModifiable(skill: PassiveSkillData): boolean {
    return !(
        skill.orbit === null ||
        !!skill.ascendancyName ||
        skill.isProxy ||
        skill.isMastery ||
        skill.isKeystone ||
        skill.isJewelSocket ||
        skill.isBlight
    );
}

function getApplicableSkills(
    passiveSkill: PassiveSkillData,
    jewel: TimelessJewel
): AlternatePassiveSkill[] {
    if (!alternatePassiveSkills) throw new Error('Not initialized');
    const type = getPassiveSkillType(passiveSkill);
    return alternatePassiveSkills.filter(
        s =>
            s.AlternateTreeVersionsKey === jewel.AlternateTreeVersion.Index &&
            s.PassiveType.includes(type)
    );
}

function getApplicableAdditions(
    passiveSkill: PassiveSkillData,
    jewel: TimelessJewel
): AlternatePassiveAddition[] {
    if (!alternatePassiveAdditions) throw new Error('Not initialized');
    const type = getPassiveSkillType(passiveSkill);
    return alternatePassiveAdditions.filter(
        a =>
            a.AlternateTreeVersionsKey === jewel.AlternateTreeVersion.Index &&
            a.PassiveType.includes(type)
    );
}

function getKeystoneReplacement(jewel: TimelessJewel): AlternatePassiveSkill | null {
    if (!alternatePassiveSkills) throw new Error('Not initialized');
    return alternatePassiveSkills.find(
        s =>
            s.AlternateTreeVersionsKey === jewel.AlternateTreeVersion.Index &&
            s.PassiveType.includes(PassiveSkillType.KeyStone)
    ) ?? null;
}

function isReplaced(skill: PassiveSkillData, jewel: TimelessJewel): boolean {
    if (skill.isKeystone) return true;

    if (skill.isNotable) {
        const spawnWeight = jewel.AlternateTreeVersion.NotableReplacementSpawnWeight;
        if (spawnWeight >= 100) return true;
        const rng = new RandomNumberGenerator(skill.skill, jewel.Seed);
        const roll = rng.generateRange(0, 100);
        return roll < spawnWeight;
    }

    const type = getPassiveSkillType(skill);
    if (type === PassiveSkillType.SmallAttribute) {
        return jewel.AlternateTreeVersion.AreSmallAttributePassiveSkillsReplaced;
    }

    return jewel.AlternateTreeVersion.AreSmallNormalPassiveSkillsReplaced;
}

function rollReplacement(
    skill: PassiveSkillData,
    jewel: TimelessJewel
): { aps: AlternatePassiveSkill; statRolls: Record<number, number> } | null {
    const applicable = getApplicableSkills(skill, jewel);
    let rolled: AlternatePassiveSkill | null = null;
    const rng = new RandomNumberGenerator(skill.skill, jewel.Seed);

    // Dummy roll for notables
    if (getPassiveSkillType(skill) === PassiveSkillType.Notable) {
        rng.generateRange(0, 100);
    }

    let currentWeight = 0;
    for (const aps of applicable) {
        currentWeight += aps.SpawnWeight;
        const roll = rng.generate(currentWeight);
        if (roll < aps.SpawnWeight) {
            rolled = aps;
        }
    }

    if (!rolled) return null;

    // Stat rolls
    const statRanges: Record<number, { min: number; max: number }> = {
        0: { min: rolled.Stat1Min, max: rolled.Stat1Max },
        1: { min: rolled.Stat2Min, max: rolled.Stat2Max },
        2: { min: rolled.Unknown10, max: rolled.Unknown11 },
        3: { min: rolled.Unknown12, max: rolled.Unknown13 },
    };

    const statRolls: Record<number, number> = {};
    for (let i = 0; i < Math.min(rolled.StatsKeys.length, 4); i++) {
        const { min, max } = statRanges[i];
        let value = min;
        if (max > min) {
            value = rng.generateRange(min, max);
        }
        statRolls[i] = value;
    }

    return { aps: rolled, statRolls };
}

function rollAddition(
    rng: RandomNumberGenerator,
    skill: PassiveSkillData,
    jewel: TimelessJewel
): { addition: AlternatePassiveAddition; statRolls: Record<number, number> } | null {
    const applicable = getApplicableAdditions(skill, jewel);
    const totalWeight = applicable.reduce((sum, a) => sum + a.SpawnWeight, 0);
    if (totalWeight === 0) return null;

    const roll = rng.generate(totalWeight);
    let current = roll;
    let chosen: AlternatePassiveAddition | null = null;

    for (const addition of applicable) {
        if (addition.SpawnWeight > current) {
            chosen = addition;
            break;
        }
        current -= addition.SpawnWeight;
    }

    if (!chosen) return null;

    const statRanges: Record<number, { min: number; max: number }> = {
        0: { min: chosen.Stat1Min, max: chosen.Stat1Max },
        1: { min: chosen.Stat2Min, max: chosen.Stat2Max },
    };

    const statRolls: Record<number, number> = {};
    for (let i = 0; i < Math.min(chosen.StatsKeys.length, 2); i++) {
        const { min, max } = statRanges[i];
        let value = min;
        if (max > min) {
            value = rng.generateRange(min, max);
        }
        statRolls[i] = value;
    }

    return { addition: chosen, statRolls };
}

function getStatLabel(statKey: number, statValue: number): string {
    if (!translations) throw new Error('Not initialized');
    const entries = translations.get(statKey);
    if (!entries) return `Stat #${statKey}: ${statValue}`;

    let entry: TranslationEntry | undefined;
    if (statValue >= 0) {
        entry = entries.find(e => e.from !== undefined && statValue >= e.from);
    } else {
        entry = entries.find(e => e.to !== undefined && statValue <= e.to);
    }

    if (!entry) {
        entry = entries[0];
    }

    if (!entry) return `Stat #${statKey}: ${statValue}`;

    const divider = entry.divider || 1;
    const displayValue = statValue / divider;
    return entry.translation.replace('{0}', String(displayValue));
}

// --- Main calculation ---

export interface LookupResult {
    seed: number;
    jewelType: string;
    jewelLabel: string;
    targetStatKeys: number[];
    targetLabels: string[];
    targetSkillId?: string;
    targetSkillName?: string;
    socketResults: SocketResult[];
    grandTotal: number;
    bestSockets: SocketResult[];
}

export async function lookupSeed(
    seed: number,
    jewelTypeId: number,
    targetStatKeys: number[],
    skillId?: string
): Promise<LookupResult> {
    if (!passiveSkills || !socketNodes) throw new Error('Not initialized');

    const version = new AlternateTreeVersion(jewelTypeId);
    const jewel = new TimelessJewel(version, seed);

    // Determine which nodes are relevant per jewel type
    // Jewel type 1 (vaal): all modifiable nodes
    // Jewel types 2-6: only notables (and keystones) that are modifiable
    const allModifiable = [...passiveSkills.values()].filter(s => isModifiable(s));
    const notableModifiable = allModifiable.filter(s => s.isNotable || s.isKeystone);
    const relevantNodes = jewelTypeId === 1 ? allModifiable : notableModifiable;

    // Build socket -> relevant nodes map
    const nodesBySocket: Record<string, PassiveSkillData[]> = {};
    for (const [socketId, nodeIds] of Object.entries(socketNodes)) {
        const nodeIdsNum = nodeIds.map(id => Number(id));
        nodesBySocket[socketId] = relevantNodes.filter(n => nodeIdsNum.includes(n.skill));
    }

    // Process each socket
    const results: SocketResult[] = [];

    for (const [socketId, nodes] of Object.entries(nodesBySocket)) {
        const socketNode = passiveSkills.get(Number(socketId));
        const coords = nodeCoords?.get(Number(socketId)) ?? { x: 0, y: 0 };
        const matches: MatchedNode[] = [];

        for (const node of nodes) {
            const replaced = isReplaced(node, jewel);

            if (replaced) {
                if (node.isKeystone) {
                    const keystone = getKeystoneReplacement(jewel);
                    if (keystone) {
                        // Filter by skillId if specified
                        if (skillId && keystone.Id !== skillId) {
                            // Still need to consume RNG for other nodes
                            rollReplacement(node, jewel);
                        } else {
                            for (const statKey of keystone.StatsKeys) {
                                if (targetStatKeys.includes(statKey)) {
                                    matches.push({
                                        nodeId: node.skill,
                                        nodeName: node.name,
                                        nodeType: 'Keystone',
                                        statKey,
                                        statValue: keystone.Stat1Min,
                                        statLabel: getStatLabel(statKey, keystone.Stat1Min),
                                        source: 'replacement',
                                        alternateSkillId: keystone.Id,
                                    });
                                }
                            }
                        }
                    }
                } else {
                    const result = rollReplacement(node, jewel);
                    if (result) {
                        // Filter by skillId if specified
                        if (skillId && result.aps.Id !== skillId) {
                            // Node was replaced but not by the target skill — skip
                        } else {
                            for (let i = 0; i < result.aps.StatsKeys.length; i++) {
                                const statKey = result.aps.StatsKeys[i];
                                const statValue = result.statRolls[i];
                                if (targetStatKeys.includes(statKey)) {
                                    matches.push({
                                        nodeId: node.skill,
                                        nodeName: node.name,
                                        nodeType: node.isNotable ? 'Notable' : 'Small',
                                        statKey,
                                        statValue,
                                        statLabel: getStatLabel(statKey, statValue),
                                        source: 'replacement',
                                        alternateSkillId: result.aps.Id,
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Check for additions (only for jewel types 2-4)
            if (jewel.AlternateTreeVersion.MinimumAdditions > 0) {
                const rng = new RandomNumberGenerator(node.skill, jewel.Seed);
                // Dummy roll for notables
                if (getPassiveSkillType(node) === PassiveSkillType.Notable) {
                    rng.generateRange(0, 100);
                }

                const minAdd = jewel.AlternateTreeVersion.MinimumAdditions;
                const maxAdd = jewel.AlternateTreeVersion.MaximumAdditions;
                const addCount = maxAdd > minAdd ? rng.generateRange(minAdd, maxAdd) : minAdd;

                for (let i = 0; i < addCount; i++) {
                    const addResult = rollAddition(rng, node, jewel);
                    if (addResult) {
                        for (let j = 0; j < addResult.addition.StatsKeys.length; j++) {
                            const statKey = addResult.addition.StatsKeys[j];
                            const statValue = addResult.statRolls[j];
                            if (targetStatKeys.includes(statKey)) {
                                matches.push({
                                    nodeId: node.skill,
                                    nodeName: node.name,
                                    nodeType: node.isNotable ? 'Notable' : 'Small',
                                    statKey,
                                    statValue,
                                    statLabel: getStatLabel(statKey, statValue),
                                    source: 'addition',
                                });
                            }
                        }
                    }
                }
            }
        }

        results.push({
            socketId,
            socketName: socketNode?.name ?? `Socket ${socketId}`,
            socketAlias: socketAliases?.get(socketId) ?? socketNode?.name ?? `Socket ${socketId}`,
            socketCoords: coords,
            matches,
            totalMatchCount: matches.length,
        });
    }

    // Sort by match count descending
    results.sort((a, b) => b.totalMatchCount - a.totalMatchCount);

    const grandTotal = results.reduce((sum, r) => sum + r.totalMatchCount, 0);
    const maxCount = results.length > 0 ? results[0].totalMatchCount : 0;
    const bestSockets = results.filter(r => r.totalMatchCount === maxCount && maxCount > 0);

    // Build target labels
    const targetLabels = targetStatKeys.map(key => {
        if (!translations) return `#${key}`;
        const entries = translations.get(key);
        if (!entries || !entries[0]) return `#${key}`;
        return entries[0].translation.replace('{0}', 'X');
    });

    const jewelType = JEWEL_TYPES.find(j => j.id === jewelTypeId);

    // Resolve skill name if skillId was provided
    let targetSkillName: string | undefined;
    if (skillId) {
        const skill = alternatePassiveSkills?.find(s => s.Id === skillId);
        targetSkillName = skill?.Name;
    }

    return {
        seed,
        jewelType: jewelType?.name ?? `type-${jewelTypeId}`,
        jewelLabel: jewelType?.label ?? `Type ${jewelTypeId}`,
        targetStatKeys,
        targetLabels,
        targetSkillId: skillId,
        targetSkillName,
        socketResults: results,
        grandTotal,
        bestSockets,
    };
}

// Re-export for module access
import { JEWEL_TYPES } from './types.js';
export { JEWEL_TYPES };

// Helper to resolve stat keys from partial name matches
export interface AlternateSkillInfo {
    id: string;
    name: string;
    jewelType: string;
    jewelLabel: string;
    passiveType: string[];
    stats: { key: number; label: string; min: number; max: number }[];
    spawnWeight: number;
}

export async function lookupAlternateSkill(query: string): Promise<AlternateSkillInfo[]> {
    if (!alternatePassiveSkills) throw new Error('Not initialized');
    const lower = query.toLowerCase();
    const results: AlternateSkillInfo[] = [];

    for (const aps of alternatePassiveSkills) {
        if (!aps.Id.toLowerCase().includes(lower)) continue;

        const jewelInfo = JEWEL_TYPES.find(j => j.id === aps.AlternateTreeVersionsKey);
        const typeLabels: string[] = [];
        for (const t of aps.PassiveType) {
            typeLabels.push(PassiveSkillType[t] ?? String(t));
        }

        const stats: AlternateSkillInfo['stats'] = [];
        const statRanges: Record<number, { min: number; max: number }> = {
            0: { min: aps.Stat1Min, max: aps.Stat1Max },
            1: { min: aps.Stat2Min, max: aps.Stat2Max },
            2: { min: aps.Unknown10, max: aps.Unknown11 },
            3: { min: aps.Unknown12, max: aps.Unknown13 },
        };

        for (let i = 0; i < Math.min(aps.StatsKeys.length, 4); i++) {
            const key = aps.StatsKeys[i];
            const { min, max } = statRanges[i];
            const label = getStatLabel(key, min);
            stats.push({ key, label, min, max });
        }

        results.push({
            id: aps.Id,
            name: aps.Name,
            jewelType: jewelInfo?.name ?? `type-${aps.AlternateTreeVersionsKey}`,
            jewelLabel: jewelInfo?.label ?? `Type ${aps.AlternateTreeVersionsKey}`,
            passiveType: typeLabels,
            stats,
            spawnWeight: aps.SpawnWeight,
        });
    }

    return results;
}

export async function searchStatKeys(query: string): Promise<{ key: number; label: string }[]> {
    if (!translations) throw new Error('Not initialized');
    const lower = query.toLowerCase();
    const results: { key: number; label: string }[] = [];

    for (const [key, entries] of translations.entries()) {
        for (const entry of entries) {
            if (entry.translation.toLowerCase().includes(lower)) {
                results.push({ key, label: entry.translation.replace('{0}', 'X') });
                break; // one match per stat key is enough
            }
        }
    }

    return results.sort((a, b) => a.label.localeCompare(b.label));
}
